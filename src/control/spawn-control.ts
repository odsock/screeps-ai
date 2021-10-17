import { CreepRole } from "config/creep-types";
import { CreepUtils } from "creep-utils";
import { Builder } from "roles/builder";
import { CreepBodyProfile } from "roles/creep-wrapper";
import { Fixer } from "roles/fixer";
import { Worker } from "roles/worker";
import { RoomWrapper } from "structures/room-wrapper";
import { SpawnWrapper } from "structures/spawn-wrapper";
import { profile } from "../../screeps-typescript-profiler";
import { SockPuppetConstants } from "../config/sockpuppet-constants";
import { SpawnUtils } from "./spawn-utils";

export interface SpawnRequest {
  priority: number;
  bodyProfile: CreepBodyProfile;
  max?: boolean;
  role: string;
  replacing?: string;
  targetRoom?: string;
  homeRoom?: string;
}

@profile
export class SpawnControl {
  private readonly rcl: number;
  private readonly freeSpawns: SpawnWrapper[];
  private readonly creepCountsByRole: { [x: string]: number } = {};
  private readonly spawnQueue: SpawnRequest[];

  public constructor(private readonly roomw: RoomWrapper) {
    this.spawnQueue = this.roomw.memory.spawnQueue ?? [];

    this.freeSpawns = this.roomw.spawns.filter(spawnw => !spawnw.spawning);
    this.rcl = this.roomw.controller?.level ? this.roomw.controller?.level : 0;

    for (const role of Object.values(CreepRole)) {
      this.creepCountsByRole[role] = this.getCreepCountForRole(role);
    }
  }

  public run(): void {
    this.printSpawningVisual();

    if (this.freeSpawns.length === 0) {
      return;
    }

    // fill spawn queue with requests (may already have some)
    if (this.rcl <= 1) {
      this.spawnEconomy();
    } else {
      this.spawnLaterRCL();
    }

    this.workSpawnQueue();
  }

  private workSpawnQueue(): void {
    this.spawnQueue.sort((a, b) => a.priority - b.priority);
    CreepUtils.consoleLogIfWatched(this.roomw, `spawn queue: ${JSON.stringify(this.spawnQueue)}`);
    this.freeSpawns.some(s => {
      const spawnRequest = this.spawnQueue.pop();
      if (spawnRequest) {
        const result = s.spawn(spawnRequest);
        CreepUtils.consoleLogIfWatched(
          this.roomw,
          `spawning: ${spawnRequest.role}, priority: ${spawnRequest.priority}`,
          result
        );
        // don't use energy on lower priority creep if high priority couldn't spawn now
        return result === ERR_NOT_ENOUGH_ENERGY;
      }
      return true;
    });
    this.roomw.memory.spawnQueue = [];
  }

  /**
   * spawn strategy for early RCL
   * one worker to bootstrap into first hauler/harvester
   * then spawn enough harvesters to max out sources
   * then spawn enough upgraders to handle 80% of harvest capacity (tweak this)
   * then spawn enough haulers to handle harvest capacity to average destination distance (tweak this)
   */
  private spawnEconomy() {
    // SEED WORKER
    // spawn one worker if no other creeps
    if (this.roomw.find(FIND_MY_CREEPS).length === 0) {
      this.creepCountsByRole[CreepRole.WORKER] += 1;
      this.spawnQueue.push({
        bodyProfile: Worker.BODY_PROFILE,
        role: Worker.ROLE,
        priority: 200
      });
    }
  }

  /**
   * Spawn strategy for later RCL
   * spawn same as RC1, with guards, builders, importers, claimers, and fixer
   */
  private spawnLaterRCL(): void {
    // spawn economy creeps with early strategy
    this.spawnEconomy();
    CreepUtils.consoleLogIfWatched(this.roomw, `check if other creeps needed`);

    // FIXER
    if (
      this.roomw.repairSites.length > 0 &&
      this.creepCountsByRole[CreepRole.FIXER] < SockPuppetConstants.MAX_FIXER_CREEPS
    ) {
      this.spawnQueue.push({
        bodyProfile: Fixer.BODY_PROFILE,
        max: true,
        role: Fixer.ROLE,
        priority: 30
      });
    }

    // BUILDER
    // make builders if there's something to build
    const builderCount = this.creepCountsByRole[Builder.ROLE];
    const workPartsNeeded = this.getBuilderWorkPartsNeeded();
    const conSiteCount = this.roomw.constructionSites.length;
    CreepUtils.consoleLogIfWatched(
      this.roomw,
      `builders: ${builderCount}, ${conSiteCount} sites, ${workPartsNeeded} parts needed`
    );
    if (conSiteCount > 0 && workPartsNeeded > 0) {
      this.spawnQueue.push({
        bodyProfile: SpawnUtils.buildBodyProfile(Builder.BODY_PROFILE, workPartsNeeded),
        role: Builder.ROLE,
        priority: 30
      });
    }
  }

  /** Gets count of creeps with role, including spawning creeps */
  private getCreepCountForRole(role: CreepRole): number {
    const count = this.roomw.find(FIND_MY_CREEPS).filter(creep => creep.memory.role === role).length;
    const numSpawning = this.freeSpawns.filter(spawn => spawn.spawning?.name.startsWith(role)).length;
    return count + numSpawning;
  }

  /** prints room visual of spawning role */
  private printSpawningVisual() {
    this.freeSpawns.forEach(spawn => {
      if (spawn.spawning) {
        const spawningCreep = Game.creeps[spawn.spawning.name];
        // try to stagger visuals so they don't overlap
        const offset = Number(spawn.name.slice(-1)) % 2 === 0 ? 1 : -1;
        this.roomw.visual.text("🐣" + spawningCreep.memory.role, spawn.pos.x, spawn.pos.y + offset, {
          align: "left",
          opacity: 0.8
        });
      }
    });
  }

  /** calculate creep bodies */

  private getBuilderWorkPartsNeeded(): number {
    const conWork = this.roomw.constructionWork;
    const builders = this.roomw.find(FIND_MY_CREEPS, { filter: creep => creep.memory.role === CreepRole.BUILDER });
    const activeWorkParts = CreepUtils.countParts(WORK, ...builders);
    const workPartsNeeded = Math.ceil(conWork / SockPuppetConstants.WORK_PER_WORKER_PART);
    const workPartsDeficit = workPartsNeeded - activeWorkParts;
    return workPartsDeficit > 0 ? workPartsDeficit : 0;
  }
}
