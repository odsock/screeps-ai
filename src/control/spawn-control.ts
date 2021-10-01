import { SockPuppetConstants } from "../config/sockpuppet-constants";
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
import { CreepRole } from "config/creep-types";
import { Harvester } from "roles/harvester";
import { Upgrader } from "roles/upgrader";
import { CreepBodyProfile } from "roles/creep-wrapper";
import { SpawnUtils } from "./spawn-utils";
import { MemoryUtils } from "planning/memory-utils";
import { profile } from "../../screeps-typescript-profiler";

@profile
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
      importers.length + _.filter(Game.spawns, spawn => spawn.spawning?.name.startsWith(Importer.ROLE)).length;
    this.creepCountsByRole[CreepRole.IMPORTER] = importerCount;

    const claimers = _.filter(Game.creeps, c => c.memory.role === CreepRole.CLAIMER).map(c => new Claimer(c));
    const claimerCount =
      claimers.length + _.filter(Game.spawns, spawn => spawn.spawning?.name.startsWith(Claimer.ROLE)).length;
    this.creepCountsByRole[CreepRole.CLAIMER] = claimerCount;
  }

  public run(): void {
    // don't spawn if hostiles
    if (this.roomw.hasHostiles) {
      return;
    }
    // try to spawn by priorities until spawn fails (low energy for priority creep)
    if (this.rcl <= 1) {
      this.spawns.filter(spawnw => !spawnw.spawning).some(spawnw => this.spawnEconomy(spawnw) !== OK);
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
  private spawnEconomy(spawnw: SpawnWrapper): ScreepsReturnCode {
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

    // BACKUP HAULER
    // spawn with max body
    const youngHaulers = this.roomw.find(FIND_MY_CREEPS, {
      filter: c => c.memory.role === Hauler.ROLE && c.ticksToLive && c.ticksToLive > 500
    });
    CreepUtils.consoleLogIfWatched(spawnw, `haulers: ${youngHaulers.length} younger than 500`);
    if (youngHaulers.length > 0) {
      return spawnw.spawn({
        body: SpawnUtils.getMaxBody(Hauler.BODY_PROFILE, spawnw),
        role: Hauler.ROLE
      });
    }

    // FIRST HARVESTER
    // always need at least one harvester
    if (this.creepCountsByRole[CreepRole.HARVESTER] === 0) {
      return this.spawnBootstrapCreep(Harvester.BODY_PROFILE, Harvester.ROLE, spawnw);
    }

    // HARVESTER
    // spawn enough harvesters to drain sources if they fit in harvest positions
    // don't count retiring harvesters, since they are being replaced
    const harvesters = spawnw.room.find(FIND_MY_CREEPS, {
      filter: creep => creep.memory.role === Harvester.ROLE && !creep.memory.retiring
    });
    const harvesterWorkParts = CreepUtils.countParts(WORK, ...harvesters);
    const harvesterWorkPartsNeeded = spawnw.roomw.sourcesEnergyCapacity / ENERGY_REGEN_TIME / HARVEST_POWER;
    const harvesterCount = this.creepCountsByRole[CreepRole.HARVESTER];
    const harvestPositionCount = spawnw.roomw.harvestPositionCount;
    CreepUtils.consoleLogIfWatched(
      spawnw,
      `harvesters: ${harvesterCount}/${harvestPositionCount} positions, ${harvesterWorkParts}/${harvesterWorkPartsNeeded} parts`
    );
    if (harvesterWorkParts < harvesterWorkPartsNeeded && harvesterCount < harvestPositionCount) {
      return this.spawnBootstrapCreep(Harvester.BODY_PROFILE, Harvester.ROLE, spawnw);
    }

    // FIRST UPGRADER
    // start upgrading once harvesting efficiently
    if (this.creepCountsByRole[CreepRole.UPGRADER] === 0) {
      return spawnw.spawn({
        body: SpawnUtils.getMaxBody(Upgrader.BODY_PROFILE, spawnw),
        role: Upgrader.ROLE
      });
    }

    // UPGRADER
    // spawn enough upgraders to match harvest capacity (accounts for building, spawning, towers)
    const upgraderCount = this.creepCountsByRole[Upgrader.ROLE];
    const upgraders = spawnw.room.find(FIND_MY_CREEPS, { filter: creep => creep.memory.role === Upgrader.ROLE });
    const conSites = spawnw.roomw.find(FIND_MY_CONSTRUCTION_SITES).length;
    if (conSites > 0 && upgraderCount > 0) {
      CreepUtils.consoleLogIfWatched(spawnw, `skipping upgraders during construction`);
    } else {
      const upgraderWorkParts = CreepUtils.countParts(WORK, ...upgraders);
      const HARVEST_TO_UPGRADE_RATIO = 0.9;
      const upgraderWorkPartsNeeded =
        (Math.min(harvesterWorkParts, harvesterWorkPartsNeeded) * HARVEST_POWER * HARVEST_TO_UPGRADE_RATIO) /
        UPGRADE_CONTROLLER_POWER;
      const upgradePositionCount = spawnw.roomw.getUpgradePositions().length;
      CreepUtils.consoleLogIfWatched(
        spawnw,
        `upgraders: ${upgraderCount}/${upgradePositionCount} positions, ${upgraderWorkParts}/${upgraderWorkPartsNeeded} parts`
      );
      if (upgraderWorkParts < upgraderWorkPartsNeeded && upgraderCount < upgradePositionCount) {
        return spawnw.spawn({
          body: SpawnUtils.getMaxBody(Upgrader.BODY_PROFILE, spawnw),
          role: Upgrader.ROLE
        });
      }
    }

    // TODO trying bigger/fewer haulers at RCL6, might not work at low RCL
    // HAULER
    // spawn enough haulers to keep up with hauling needed
    // const haulerCount = this.creepCountsByRole[Hauler.ROLE];
    // const sourcesPlusOne = spawnw.roomw.sources.length + 1;
    // CreepUtils.consoleLogIfWatched(spawnw, `haulers: ${haulerCount}/${sourcesPlusOne}`);
    // if (haulerCount < sourcesPlusOne) {
    //   return this.spawnBootstrapCreep(Hauler.BODY_PROFILE, Hauler.ROLE, spawnw);
    // }

    // try to replace any aging minder seamlessly
    const replaceUpgraderResult = this.spawnReplacementMinders(spawnw, upgraders, Upgrader);
    if (replaceUpgraderResult !== ERR_NOT_FOUND) {
      return replaceUpgraderResult;
    }

    const replaceHarvesterResult = this.spawnReplacementMinders(spawnw, harvesters, Harvester);
    if (replaceHarvesterResult !== ERR_NOT_FOUND) {
      return replaceHarvesterResult;
    }

    return ERR_NOT_FOUND;
  }

  private spawnRemoteEconomy(spawnw: SpawnWrapper): ScreepsReturnCode {
    // IMPORTER
    const remoteHarvestRooms = TargetConfig.REMOTE_HARVEST[Game.shard.name].filter(name => {
      return !Game.rooms[name]?.controller?.my;
    });
    for (const roomName of remoteHarvestRooms) {
      const importersNeeded = this.calcImportersNeededForRoom(roomName, spawnw);
      const importersOnRoom = _.filter(
        Game.creeps,
        creep => creep.memory.role === Importer.ROLE && creep.memory.targetRoom === roomName
      ).length;
      CreepUtils.consoleLogIfWatched(spawnw, `importers for ${roomName}: ${importersOnRoom}/${importersNeeded}`);
      if (importersNeeded > importersOnRoom) {
        return spawnw.spawn({
          body: SpawnUtils.getMaxBody(Importer.BODY_PROFILE, spawnw),
          role: Importer.ROLE,
          targetRoom: roomName
        });
      }
    }

    // CLAIMER
    const maxClaimers = this.getMaxClaimerCount();
    if (this.creepCountsByRole[CreepRole.CLAIMER] < maxClaimers) {
      const remoteTargetRooms = TargetConfig.TARGETS[Game.shard.name].filter(name => {
        return !Game.rooms[name]?.controller?.my;
      });
      for (const roomName of [...remoteTargetRooms, ...remoteHarvestRooms]) {
        const claimerOnRoom = !!_.filter(
          Game.creeps,
          creep => creep.memory.role === Claimer.ROLE && creep.memory.targetRoom === roomName
        ).length;
        CreepUtils.consoleLogIfWatched(spawnw, `claimer for ${roomName}: ${String(claimerOnRoom)}`);
        if (!claimerOnRoom) {
          return spawnw.spawn({
            body: SpawnUtils.getMaxBody(Claimer.BODY_PROFILE, spawnw),
            role: Claimer.ROLE,
            targetRoom: roomName
          });
        }
      }
    }

    // REMOTE WORKER
    // spawn one remote worker for each claimed room with no spawn
    const noSpawnClaimedRooms = _.filter(
      Game.rooms,
      room =>
        room.controller?.owner &&
        room.controller?.owner.username === spawnw.owner.username &&
        room.find(FIND_MY_SPAWNS).length === 0
    );
    const remoteWorkers = _.filter(Game.creeps, creep => creep.memory.role === Worker.ROLE && creep.memory.targetRoom);
    if (remoteWorkers.length < noSpawnClaimedRooms.length) {
      const targetRoom = noSpawnClaimedRooms.find(
        room => !remoteWorkers.find(creep => creep.memory.targetRoom === room.name)
      );
      if (targetRoom) {
        return spawnw.spawn({
          body: SpawnUtils.getMaxBody(Worker.BODY_PROFILE, spawnw),
          role: Worker.ROLE,
          targetRoom: targetRoom.name
        });
      }
    }

    return ERR_NOT_FOUND;
  }

  private calcImportersNeededForRoom(roomName: string, spawnw: SpawnWrapper): number {
    // return cached value if room capacity hasn't changed
    const remoteHarvestRoomMemory = this.roomw.memory.remoteHarvest?.[roomName];
    if (remoteHarvestRoomMemory?.spawnCapacity === this.roomw.energyCapacityAvailable) {
      return remoteHarvestRoomMemory.importersNeeded;
    }

    // use importer as scout if no recon for room
    const roomMemory = Memory.rooms[roomName];
    if (!roomMemory) {
      return 1;
    }
    // don't spawn importers for owned rooms, or reserved by other players
    if (
      roomMemory.controller?.structure?.owner ||
      roomMemory.controller?.structure?.reservation?.username !== spawnw.owner.username
    ) {
      return 0;
    }

    // spawn enough importers at current max size to maximize harvest
    const importerBody = SpawnUtils.getMaxBody(Importer.BODY_PROFILE, spawnw);
    const energyCapacity = importerBody.filter(part => part === CARRY).length * CARRY_CAPACITY;
    const ticksToFill = energyCapacity / (importerBody.filter(part => part === WORK).length * HARVEST_POWER);

    const dropPos = this.roomw.storage?.pos ?? this.roomw.spawns[0].pos;
    const sources = Memory.rooms[roomName].sources;
    let importersNeeded = 0;
    for (const sourceId in sources) {
      const sourcePos = MemoryUtils.unpackRoomPosition(sources[sourceId].pos);
      const path = PathFinder.search(dropPos, sourcePos);
      importersNeeded += (10 * (path.path.length * 2 + ticksToFill)) / energyCapacity;
    }
    // cache result in memory
    const remoteHarvestRoom = { importersNeeded, spawnCapacity: this.roomw.energyCapacityAvailable };
    this.roomw.memory.remoteHarvest = this.roomw.memory.remoteHarvest ?? {};
    this.roomw.memory.remoteHarvest[roomName] = remoteHarvestRoom;
    return importersNeeded;
  }

  /**
   * Spawn strategy for later RCL
   * spawn same as RC1, with guards, builders, importers, claimers, and fixer
   */
  private spawnLaterRCL(spawnw: SpawnWrapper): ScreepsReturnCode {
    // spawn economy creeps with early strategy
    const result = this.spawnEconomy(spawnw);
    CreepUtils.consoleLogIfWatched(spawnw, `economy spawn result`, result);
    if (result !== ERR_NOT_FOUND) {
      return result;
    }

    CreepUtils.consoleLogIfWatched(spawnw, `check if other creeps needed`);

    // FIXER
    if (
      this.roomw.repairSites.length > 0 &&
      this.creepCountsByRole[CreepRole.FIXER] < SockPuppetConstants.MAX_FIXER_CREEPS
    ) {
      return spawnw.spawn({ body: SpawnUtils.getMaxBody(Fixer.BODY_PROFILE, spawnw), role: Fixer.ROLE });
    }

    const remoteResult = this.spawnRemoteEconomy(spawnw);
    CreepUtils.consoleLogIfWatched(spawnw, `remote economy spawn result`, remoteResult);
    if (remoteResult !== ERR_NOT_FOUND) {
      return remoteResult;
    }

    // BUILDER
    // make builders if there's something to build
    const builderCount = this.creepCountsByRole[Builder.ROLE];
    const workPartsNeeded = this.getBuilderWorkPartsNeeded();
    const conSiteCount = this.roomw.constructionSites.length;
    CreepUtils.consoleLogIfWatched(
      spawnw,
      `builders: ${builderCount}, ${conSiteCount} sites, ${workPartsNeeded} parts needed`
    );
    if (conSiteCount > 0 && workPartsNeeded > 0) {
      return spawnw.spawn({
        body: this.getBuilderBody(Builder.BODY_PROFILE, workPartsNeeded, spawnw),
        role: Builder.ROLE
      });
    }

    return ERR_NOT_FOUND;
  }

  /** Gets count of creeps with role, including spawning creeps */
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

  private spawnBootstrapCreep(bodyProfile: CreepBodyProfile, role: CreepRole, spawnw: SpawnWrapper): ScreepsReturnCode {
    let body: BodyPartConstant[];
    if (this.creepCountsByRole[role] <= 0) {
      body = SpawnUtils.getMaxBodyNow(bodyProfile, spawnw);
    } else {
      body = SpawnUtils.getMaxBody(bodyProfile, spawnw);
    }
    const result = spawnw.spawn({ body, role });
    return result;
  }

  private spawnReplacementMinders(
    spawnw: SpawnWrapper,
    creeps: Creep[],
    type: typeof Upgrader | typeof Harvester
  ): ScreepsReturnCode {
    const replacementTime = SpawnUtils.calcReplacementTime(type, spawnw);
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

  private getBuilderBody(
    bodyProfile: CreepBodyProfile,
    workPartsNeeded: number,
    spawnw: SpawnWrapper
  ): BodyPartConstant[] {
    const workPartsInProfile = bodyProfile.profile.filter(part => part === WORK).length;
    bodyProfile.maxBodyParts =
      (workPartsNeeded / workPartsInProfile) * bodyProfile.profile.length + bodyProfile.seed.length;
    const body = SpawnUtils.getMaxBody(bodyProfile, spawnw);
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
}
