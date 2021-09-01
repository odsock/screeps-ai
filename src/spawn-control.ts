import { Constants } from "./constants";
import { CreepUtils } from "creep-utils";
import { Builder } from "roles/builder";
import { Claimer } from "roles/claimer";
import { CreepFactory } from "roles/creep-factory";
import { Fixer } from "roles/fixer";
import { Hauler } from "roles/hauler";
import { Importer } from "roles/importer";
import { Minder } from "roles/minder";
import { Worker } from "roles/worker";
import { RoomWrapper } from "structures/room-wrapper";
import { TargetConfig } from "target-config";
import { SpawnWrapper } from "structures/spawn-wrapper";
import { Guard } from "roles/guard";
import { MemoryUtils } from "planning/memory-utils";

export enum CreepRole {
  BUILDER = "builder",
  CLAIMER = "claimer",
  FIXER = "fixer",
  HAULER = "hauler",
  IMPORTER = "importer",
  MINDER = "minder",
  WORKER = "worker",
  GUARD = "guard"
}

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

  private getCreepCountForRole(role: CreepRole): number {
    const count = this.roomw.find(FIND_MY_CREEPS).filter(creep => creep.memory.role === role).length;
    const numSpawning = this.spawns.filter(spawn => spawn.spawning?.name.startsWith(Minder.ROLE)).length;
    return count + numSpawning;
  }

  public run(): void {
    this.spawns
      .filter(spawnw => !spawnw.spawning)
      .some(spawnw => {
        // spawn guard if there are hostiles,
        // TODO or if reported by a target room
        if (this.roomw.hostileCreeps.length > this.creepCountsByRole[CreepRole.GUARD]) {
          if (this.roomw.controller) {
            this.roomw.controller.activateSafeMode();
          }
          return this.spawnGuardCreep(Guard.BODY_PROFILE, Guard.ROLE, spawnw) !== OK;
        }

        // make sure there is at least one minder if there is a container
        if (this.containers.length > 0 && this.creepCountsByRole[CreepRole.MINDER] === 0) {
          return this.spawnBootstrapCreep(Minder.BODY_PROFILE, Minder.ROLE, spawnw) !== OK;
        }

        // make sure there is at least one hauler if there is a container
        const maxHaulerCount = this.getMaxHaulerCount();
        if (maxHaulerCount > 0 && this.creepCountsByRole[CreepRole.HAULER] === 0) {
          return this.spawnBootstrapCreep(Hauler.BODY_PROFILE, Hauler.ROLE, spawnw) !== OK;
        }

        // spawn minder for each container
        if (this.creepCountsByRole[CreepRole.MINDER] < this.containers.length) {
          return this.spawnBootstrapCreep(Minder.BODY_PROFILE, Minder.ROLE, spawnw) !== OK;
        }

        // TODO: probably hauler numbers should depend on the length of route vs upgrade work speed
        if (this.creepCountsByRole[CreepRole.HAULER] < maxHaulerCount) {
          return this.spawnBootstrapCreep(Hauler.BODY_PROFILE, Hauler.ROLE, spawnw) !== OK;
        }

        if (this.creepCountsByRole[CreepRole.WORKER] < this.getMaxWorkerCount()) {
          return this.spawnBootstrapCreep(Worker.BODY_PROFILE, Worker.ROLE, spawnw);
        }

        if (this.roomw.repairSites.length > 0 && this.creepCountsByRole[CreepRole.FIXER] < Constants.MAX_FIXER_CREEPS) {
          return spawnw.spawn(this.getMaxBody(Fixer.BODY_PROFILE), Fixer.ROLE) !== OK;
        }

        const remoteHarvestTargetCount = TargetConfig.REMOTE_HARVEST[Game.shard.name].filter(name => {
          return !Game.rooms[name]?.controller?.my;
        }).length;
        if (
          this.creepCountsByRole[CreepRole.IMPORTER] <
          remoteHarvestTargetCount * TargetConfig.IMPORTERS_PER_REMOTE_ROOM
        ) {
          return spawnw.spawn(this.getMaxBody(Importer.BODY_PROFILE), Importer.ROLE) !== OK;
        }

        // make builders if there's something to build and past level 1
        const workPartsNeeded = this.getBuilderWorkPartsNeeded();
        if (
          this.creepCountsByRole[CreepRole.WORKER] === 0 &&
          this.roomw.constructionSites.length > 0 &&
          workPartsNeeded > 0
        ) {
          return spawnw.spawn(this.getBuilderBody(Builder.BODY_PROFILE, workPartsNeeded), Builder.ROLE) !== OK;
        }

        const maxClaimers = this.getMaxClaimerCount();
        if (this.creepCountsByRole[CreepRole.CLAIMER] < maxClaimers) {
          return spawnw.spawn(this.getMaxBody(Claimer.BODY_PROFILE), Claimer.ROLE) !== OK;
        }

        // TODO: replace small minders early, for faster recovery from attack or mistakes
        // try to replace any aging minder seamlessly
        return this.replaceOldMinders(spawnw) !== OK;
      });

    // print role of spawning creep as visual
    this.spawns.forEach(spawn => {
      if (spawn.spawning) {
        const spawningCreep = Game.creeps[spawn.spawning.name];
        this.roomw.visual.text("🐣" + spawningCreep.memory.role, spawn.pos.x + 1, spawn.pos.y, {
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
    if (this.creepCountsByRole[CreepRole.MINDER] <= 0) {
      body = this.getMaxBodyNow(profile, spawnw);
    } else {
      body = this.getMaxBody(profile);
    }
    const result = spawnw.spawn(body, role);
    return result;
  }

  private replaceOldMinders(spawnw: SpawnWrapper): ScreepsReturnCode {
    const minders = this.roomw.find(FIND_MY_CREEPS, { filter: creep => creep.memory.role === CreepRole.MINDER });
    for (const creep of minders) {
      const minder = CreepFactory.getCreep(creep);
      if (!minder.spawning && !minder.memory.retiring === true) {
        const body = this.getMaxBody(Minder.BODY_PROFILE);
        const ticksToSpawn = body.length * CREEP_SPAWN_TIME;
        const pathToReplace = CreepUtils.getPath(spawnw.pos, minder.pos);
        const ticksToReplace = minder.calcWalkTime(pathToReplace);
        if (minder.ticksToLive && minder.ticksToLive <= ticksToSpawn + ticksToReplace) {
          const result = this.spawnBootstrapCreep(Minder.BODY_PROFILE, Minder.ROLE, spawnw);
          if (result === OK) {
            minder.memory.retiring = true;
          }
          return result;
        }
      }
    }
    return OK;
  }

  /** plan creep count functions */

  private getMaxClaimerCount(): number {
    const targetRoomNames = TargetConfig.TARGETS[Game.shard.name];
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

  // TODO: make this depend on the distance from sources to controller/spawn/storage
  private getMaxHaulerCount(): number {
    return this.roomw.sourceContainers.length;
  }

  // TODO seems like this belongs in planner
  private getMaxWorkerCount(): number {
    // make workers in early stages
    if (this.rcl <= 1 || (this.containers.length === 0 && this.creepCountsByRole[CreepRole.MINDER] === 0)) {
      // make at least one worker per harvest position
      const harvestPositions = this.roomw.harvestPositions.length;
      if (harvestPositions > this.creepCountsByRole[CreepRole.WORKER]) {
        return harvestPositions;
      }
      CreepUtils.consoleLogIfWatched(this.roomw, `harvest positions: ${harvestPositions}`);

      // limit at 20 WORK per source because 10 will empty it, but supplement energy with importers
      const workers = this.roomw.find(FIND_MY_CREEPS, { filter: creep => creep.memory.role === CreepRole.WORKER });
      const workPartCount = workers.reduce<number>((count, creep) => count + CreepUtils.countParts(creep, WORK), 0);
      const avgWorkerWorkParts = workPartCount / this.creepCountsByRole[CreepRole.WORKER];
      CreepUtils.consoleLogIfWatched(this.roomw, `average worker work parts: ${avgWorkerWorkParts}`);
      if (avgWorkerWorkParts >= 20) {
        return this.creepCountsByRole[CreepRole.WORKER];
      }

      // calculate time to harvest
      const carryPartCount = workers.reduce<number>((count, creep) => count + CreepUtils.countParts(creep, CARRY), 0);
      const avgWorkerCarry = (carryPartCount * CARRY_CAPACITY) / this.creepCountsByRole[CreepRole.WORKER];
      CreepUtils.consoleLogIfWatched(this.roomw, `average worker carry: ${avgWorkerCarry}`);
      const ticksToHarvest = avgWorkerCarry / (avgWorkerWorkParts * HARVEST_POWER);
      CreepUtils.consoleLogIfWatched(this.roomw, `ticks to harvest: ${ticksToHarvest}`);

      // cache this expensive nested loop
      let longestSourceRangeToSpawn = MemoryUtils.getCache<number>(`${this.roomw.name}_longestSourceRangeToSpawn`);
      if (!longestSourceRangeToSpawn) {
        longestSourceRangeToSpawn = this.roomw.sources.reduce<number>((outerRange, source) => {
          return this.roomw.spawns.reduce<number>((innerRange, spawn) => {
            const range = source.pos.getRangeTo(spawn.pos.x, spawn.pos.y);
            return innerRange > range ? innerRange : range;
          }, outerRange);
        }, 0);
        MemoryUtils.setCache(`${this.roomw.name}_longestSourceRangeToSpawn`, longestSourceRangeToSpawn, 1000);
      }
      CreepUtils.consoleLogIfWatched(this.roomw, `longest source range from spawn: ${longestSourceRangeToSpawn}`);

      const harvestCyclesPerTransit = (longestSourceRangeToSpawn * 2) / ticksToHarvest;
      CreepUtils.consoleLogIfWatched(this.roomw, `harvest cycles per transit: ${harvestCyclesPerTransit}`);
      const maxWorkerCount = harvestPositions + harvestCyclesPerTransit;
      CreepUtils.consoleLogIfWatched(this.roomw, `max workers: ${maxWorkerCount}`);

      return maxWorkerCount;
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
    const activeWorkParts = builders.reduce<number>(
      (count: number, creep) => count + CreepUtils.countParts(creep, WORK),
      0
    );
    const workPartsNeeded = Math.ceil(conWork / Constants.WORK_PER_WORKER_PART);
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
    } while (this.calcBodyCost(body) < SPAWN_ENERGY_CAPACITY);
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
