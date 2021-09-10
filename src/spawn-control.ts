import { SockPuppetConstants } from "./config/sockpuppet-constants";
import { CreepUtils } from "creep-utils";
import { Builder } from "roles/builder";
import { Claimer } from "roles/claimer";
import { Fixer } from "roles/fixer";
import { Hauler } from "roles/hauler";
import { Importer } from "roles/importer";
import { Worker } from "roles/worker";
import { RoomWrapper } from "structures/room-wrapper";
import { TargetConfig } from "config/target-config";
import { SpawnWrapper } from "structures/spawn-wrapper";
import { Guard } from "roles/guard";
import { CreepRole } from "config/creep-types";
import { Harvester } from "roles/harvester";
import { Upgrader } from "roles/upgrader";

export class SpawnControl {
  private readonly containers: AnyStructure[];
  private readonly rcl: number;
  private readonly spawns: SpawnWrapper[];

  private readonly creepCountsByRole: { [x: string]: number } = {};

  public constructor(private readonly roomw: RoomWrapper) {
    this.spawns = this.roomw.spawns;
    this.containers = this.roomw.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_CONTAINER });
    this.rcl = this.roomw.controller?.level ? this.roomw.controller?.level : 0;

    for (const role of Object.values(CreepRole)) {
      this.creepCountsByRole[role] = this.getCreepCountForRole(role);
    }

    const importers = _.filter(Game.creeps, c => c.memory.role === CreepRole.IMPORTER).map(c => new Importer(c));
    const importerCount =
      importers.length + this.spawns.filter(spawn => spawn.spawning?.name.startsWith(Importer.ROLE)).length;
    this.creepCountsByRole[CreepRole.IMPORTER] = importerCount;

    const claimers = _.filter(Game.creeps, c => c.memory.role === CreepRole.CLAIMER).map(c => new Claimer(c));
    const claimerCount =
      claimers.length + this.spawns.filter(spawn => spawn.spawning?.name.startsWith(Claimer.ROLE)).length;
    this.creepCountsByRole[CreepRole.CLAIMER] = claimerCount;
  }

  public run(): void {
    // try to spawn by priorities until spawn fails (low energy for priority creep)
    if (this.rcl <= 1) {
      this.spawns.filter(spawnw => !spawnw.spawning).some(spawnw => this.spawnEarlyRCL(spawnw) !== OK);
    } else {
      this.spawns.filter(spawnw => !spawnw.spawning).some(spawnw => this.spawnLaterRCL(spawnw) !== OK);
    }

    // print role of spawning creep as visual
    this.printSpawningVisual();
  }

  /**
   * spawn strategy for early RCL
   * one worker to bootstrap into first hauler/harvester
   * then spawn enough harvesters to max out sources
   * then spawn enough upgraders to handle 80% of harvest capacity (tweak this)
   * then spawn enough haulers to handle harvest capacity to average destination distance (tweak this)
   */
  private spawnEarlyRCL(spawnw: SpawnWrapper): ScreepsReturnCode {
    // SEED WORKER
    // spawn one worker if no other creeps
    if (spawnw.room.find(FIND_MY_CREEPS).length === 0) {
      return this.spawnBootstrapCreep(Worker.BODY_PROFILE, Worker.ROLE, spawnw);
    }

    // FIRST HAULER
    // always need at least one hauler to fill spawns and move harvesters
    if (this.creepCountsByRole[CreepRole.HAULER] === 0) {
      return this.spawnBootstrapCreep(Hauler.BODY_PROFILE, Hauler.ROLE, spawnw);
    }

    // FIRST HARVESTER
    // always need at least one harvester
    if (this.creepCountsByRole[CreepRole.HARVESTER] === 0) {
      return this.spawnBootstrapCreep(Harvester.BODY_PROFILE, Harvester.ROLE, spawnw);
    }

    // HARVESTER
    // spawn enough harvesters to drain sources if they fit in harvest positions
    const harvesters = spawnw.room.find(FIND_MY_CREEPS, { filter: creep => creep.memory.role === Harvester.ROLE });
    const harvesterWorkParts = CreepUtils.countParts(WORK, ...harvesters);
    const harvesterWorkPartsNeeded = spawnw.roomw.sourcesEnergyCapacity / ENERGY_REGEN_TIME / HARVEST_POWER;
    console.log(`DEBUG: harvester work parts: ${harvesterWorkParts}/${harvesterWorkPartsNeeded}`);
    if (
      harvesterWorkParts < harvesterWorkPartsNeeded &&
      this.creepCountsByRole[CreepRole.HARVESTER] < spawnw.roomw.harvestPositionCount
    ) {
      return this.spawnBootstrapCreep(Harvester.BODY_PROFILE, Harvester.ROLE, spawnw);
    }

    // FIRST UPGRADER
    // start upgrading once harvesting efficiently
    if (this.creepCountsByRole[CreepRole.UPGRADER] === 0) {
      return this.spawnBootstrapCreep(Upgrader.BODY_PROFILE, Upgrader.ROLE, spawnw);
    }

    // UPGRADER
    // spawn enough upgraders to match 80% of harvest capacity (accounts for building, spawning, towers)
    const upgraders = spawnw.room.find(FIND_MY_CREEPS, { filter: creep => creep.memory.role === Upgrader.ROLE });
    const upgraderWorkParts = CreepUtils.countParts(WORK, ...upgraders);
    const HARVEST_TO_UPGRADE_RATIO = 0.7;
    const upgraderWorkPartsNeeded =
      (harvesterWorkParts * HARVEST_POWER * HARVEST_TO_UPGRADE_RATIO) / UPGRADE_CONTROLLER_POWER;
    if (upgraderWorkParts < upgraderWorkPartsNeeded) {
      return this.spawnBootstrapCreep(Upgrader.BODY_PROFILE, Upgrader.ROLE, spawnw);
    }

    // HAULER
    // spawn enough haulers to keep up with hauling harvested energy average distance
    const haulers = spawnw.room.find(FIND_MY_CREEPS, { filter: creep => creep.memory.role === Hauler.ROLE });
    const haulerCarryParts = CreepUtils.countParts(CARRY, ...haulers);
    const haulerTargets = spawnw.room
      .find(FIND_MY_STRUCTURES, {
        filter: structure =>
          structure.structureType === STRUCTURE_SPAWN ||
          structure.structureType === STRUCTURE_EXTENSION ||
          structure.structureType === STRUCTURE_TOWER ||
          structure.structureType === STRUCTURE_STORAGE ||
          structure.structureType === STRUCTURE_CONTROLLER
      })
      .map(structure => structure.pos);
    const sourcePositions = spawnw.roomw.sources.map(source => source.pos);
    const distance = CreepUtils.calculatePositionSetDistance(sourcePositions, haulerTargets);
    const haulerCarryPartsNeeded = (harvesterWorkParts * HARVEST_POWER * distance * 2) / CARRY_CAPACITY;
    CreepUtils.consoleLogIfWatched(spawnw, `hauler parts: ${haulerCarryParts}/${haulerCarryPartsNeeded}`);
    if (haulerCarryParts < haulerCarryPartsNeeded) {
      return this.spawnBootstrapCreep(Hauler.BODY_PROFILE, Hauler.ROLE, spawnw);
    }

    // try to replace any aging minder seamlessly
    return this.replaceOldMinders(spawnw);
  }

  /**
   * Spawn strategy for later RCL
   * spawn same as RC1, with guards, builders, importers, claimers, and fixer
   */
  private spawnLaterRCL(spawnw: SpawnWrapper): ScreepsReturnCode {
    // GUARD
    // spawn guard for each scary room
    CreepUtils.consoleLogIfWatched(spawnw, `check if guard needed`);
    const roomsByScary = _.countBy(Game.rooms, "memory.scary");
    if (roomsByScary.true > this.creepCountsByRole[CreepRole.GUARD]) {
      if (this.roomw.controller) {
        this.roomw.controller.activateSafeMode();
      }
      return this.spawnGuardCreep(Guard.BODY_PROFILE, Guard.ROLE, spawnw);
    }

    // spawn economy creeps with early strategy
    const result = this.spawnEarlyRCL(spawnw);
    CreepUtils.consoleLogIfWatched(spawnw, `early RCL spawn result`, result);
    if (result !== OK) {
      return result;
    }

    CreepUtils.consoleLogIfWatched(spawnw, `check if other creeps needed`);

    // FIXER
    if (
      this.roomw.repairSites.length > 0 &&
      this.creepCountsByRole[CreepRole.FIXER] < SockPuppetConstants.MAX_FIXER_CREEPS
    ) {
      return spawnw.spawn(this.getMaxBody(Fixer.BODY_PROFILE), Fixer.ROLE);
    }

    // IMPORTER
    const remoteHarvestTargetCount = TargetConfig.REMOTE_HARVEST[Game.shard.name].filter(name => {
      return !Game.rooms[name]?.controller?.my;
    }).length;
    if (
      this.creepCountsByRole[CreepRole.IMPORTER] <
      remoteHarvestTargetCount * TargetConfig.IMPORTERS_PER_REMOTE_ROOM
    ) {
      return spawnw.spawn(this.getMaxBody(Importer.BODY_PROFILE), Importer.ROLE);
    }

    // BUILDER
    // make builders if there's something to build
    const workPartsNeeded = this.getBuilderWorkPartsNeeded();
    if (
      this.creepCountsByRole[CreepRole.WORKER] === 0 &&
      this.roomw.constructionSites.length > 0 &&
      workPartsNeeded > 0
    ) {
      return spawnw.spawn(this.getBuilderBody(Builder.BODY_PROFILE, workPartsNeeded), Builder.ROLE);
    }

    // CLAIMER
    const maxClaimers = this.getMaxClaimerCount();
    if (this.creepCountsByRole[CreepRole.CLAIMER] < maxClaimers) {
      return spawnw.spawn(this.getMaxBody(Claimer.BODY_PROFILE), Claimer.ROLE);
    }

    return ERR_NOT_FOUND;
  }

  private getCreepCountForRole(role: CreepRole): number {
    const count = this.roomw.find(FIND_MY_CREEPS).filter(creep => creep.memory.role === role).length;
    const numSpawning = this.spawns.filter(spawn => spawn.spawning?.name.startsWith(role)).length;
    return count + numSpawning;
  }

  /** prints room visual of spawning role */
  private printSpawningVisual() {
    this.spawns.forEach(spawn => {
      if (spawn.spawning) {
        const spawningCreep = Game.creeps[spawn.spawning.name];
        // try to stagger visuals so they don't overlap
        const offset = Number(spawn.name.substring(-1)) % 2 === 0 ? 1 : -1;
        this.roomw.visual.text("🐣" + spawningCreep.memory.role, spawn.pos.x, spawn.pos.y + offset, {
          align: "left",
          opacity: 0.8
        });
      }
    });
  }

  private spawnGuardCreep(profile: CreepBodyProfile, role: CreepRole, spawnw: SpawnWrapper): ScreepsReturnCode {
    const result = spawnw.spawn(profile.profile, role);
    return result;
  }

  private spawnBootstrapCreep(profile: CreepBodyProfile, role: CreepRole, spawnw: SpawnWrapper): ScreepsReturnCode {
    let body: BodyPartConstant[];
    if (this.creepCountsByRole[role] <= 0) {
      body = this.getMaxBodyNow(profile, spawnw);
    } else {
      body = this.getMaxBody(profile);
    }
    const result = spawnw.spawn(body, role);
    return result;
  }

  private replaceOldMinders(spawnw: SpawnWrapper): ScreepsReturnCode {
    const upgraders = this.roomw.find(FIND_MY_CREEPS, { filter: creep => creep.memory.role === Upgrader.ROLE });
    let result = this.spawnReplacementMinder(spawnw, upgraders, Upgrader);
    if (result === OK) {
      return result;
    }

    const harvesters = this.roomw.find(FIND_MY_CREEPS, { filter: creep => creep.memory.role === Harvester.ROLE });
    result = this.spawnReplacementMinder(spawnw, harvesters, Harvester);
    if (result === ERR_NOT_FOUND) {
      return OK;
    }
    return result;
  }

  private spawnReplacementMinder(
    spawnw: SpawnWrapper,
    creeps: Creep[],
    type: typeof Upgrader | typeof Harvester
  ): ScreepsReturnCode {
    const replacementTime = this.calcReplacementTime(type, spawnw);
    for (const creep of creeps) {
      if (!creep.spawning && !creep.memory.retiring) {
        if (creep.ticksToLive && creep.ticksToLive <= replacementTime) {
          const result = this.spawnBootstrapCreep(type.BODY_PROFILE, type.ROLE, spawnw);
          if (result === OK) {
            creep.memory.retiring = true;
          }
          return result;
        }
      }
    }
    return ERR_NOT_FOUND;
  }

  private calcReplacementTime(type: typeof Upgrader | typeof Harvester, spawnw: SpawnWrapper) {
    const body = this.getMaxBody(type.BODY_PROFILE);
    const spawningTime = body.length * CREEP_SPAWN_TIME;
    // walk time is hard to calc if using a hauler to tug
    // overestimate it, and suicide the retiree when you arrive
    const WALK_TIME = 50;
    const replacementTime = spawningTime + WALK_TIME;
    CreepUtils.consoleLogIfWatched(spawnw, `replacement time: ${replacementTime} ticks`);
    return replacementTime;
  }

  /** plan creep count functions */

  private getMaxClaimerCount(): number {
    const targetRoomNames = TargetConfig.TARGETS[Game.shard.name].concat(TargetConfig.REMOTE_HARVEST[Game.shard.name]);
    if (targetRoomNames) {
      return targetRoomNames.filter(roomName => {
        // validate room name
        try {
          new RoomPosition(0, 0, roomName);
          // can't do this without a creep in the room
        } catch (error) {
          console.log(`ERROR: bad target config: ${roomName}`);
          return false;
        }
        // don't spawn claimers for rooms we own
        if (Game.rooms[roomName]?.controller?.my) {
          return false;
        }
        return true;
      }).length;
    }
    return 0;
  }

  /** calculate creep bodies */

  // TODO: generalize this for any parts requirement
  private getBuilderBody(bodyProfile: CreepBodyProfile, workPartsNeeded: number): BodyPartConstant[] {
    const workPartsInProfile = bodyProfile.profile.filter(part => part === WORK).length;
    bodyProfile.maxBodyParts =
      (workPartsNeeded / workPartsInProfile) * bodyProfile.profile.length + bodyProfile.seed.length;
    const body = this.getMaxBody(bodyProfile);
    return body;
  }

  private getBuilderWorkPartsNeeded(): number {
    const conWork = this.roomw.constructionWork;
    const builders = this.roomw.find(FIND_MY_CREEPS, { filter: creep => creep.memory.role === CreepRole.BUILDER });
    const activeWorkParts = CreepUtils.countParts(WORK, ...builders);
    const workPartsNeeded = Math.ceil(conWork / SockPuppetConstants.WORK_PER_WORKER_PART);
    const workPartsDeficit = workPartsNeeded - activeWorkParts;
    return workPartsDeficit > 0 ? workPartsDeficit : 0;
  }

  /**
   * Creates creep body profile based on array of body constants and max size allowed.
   */
  // TODO implement maxWorkParts and other part type checks
  private getMaxBody(creepBodyProfile: CreepBodyProfile): BodyPartConstant[] {
    let body: BodyPartConstant[] = creepBodyProfile.seed.slice();
    // if no seed start with one instance of profile
    if (body.length === 0) {
      body = creepBodyProfile.profile.slice();
    }
    let finalBody: BodyPartConstant[] = [];
    if (creepBodyProfile.maxBodyParts > MAX_CREEP_SIZE) {
      creepBodyProfile.maxBodyParts = MAX_CREEP_SIZE;
    }
    const energyCapacity = this.roomw.energyCapacityAvailable;
    do {
      finalBody = body.slice();
      body = body.concat(creepBodyProfile.profile);
    } while (this.calcBodyCost(body) <= energyCapacity && body.length <= creepBodyProfile.maxBodyParts);
    return finalBody.sort();
  }

  private getMaxBodyNow(bodyProfile: CreepBodyProfile, spawnw: SpawnWrapper) {
    // first make body as large as possible under 300 spawn energy
    let body = bodyProfile.seed.slice();
    let finalBody: BodyPartConstant[] = [];
    do {
      finalBody = body.slice();
      body = body.concat(bodyProfile.profile);
    } while (this.calcBodyCost(body) <= SPAWN_ENERGY_CAPACITY);
    body = finalBody.slice();

    // grow body until all available energy is used
    do {
      finalBody = body.slice();
      body = body.concat(bodyProfile.profile);
    } while (
      spawnw.spawnCreep(body, "maximizeBody", { dryRun: true }) === 0 &&
      body.length + bodyProfile.profile.length <= bodyProfile.maxBodyParts
    );
    return finalBody.sort();
  }

  private calcBodyCost(body: BodyPartConstant[]): number {
    return body.map(part => BODYPART_COST[part]).reduce((cost, partCost) => cost + partCost);
  }
}
