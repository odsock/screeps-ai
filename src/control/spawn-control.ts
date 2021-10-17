import { Builder } from "roles/builder";
import { Claimer } from "roles/claimer";
import { CreepBodyProfile } from "roles/creep-wrapper";
import { CreepRole } from "config/creep-types";
import { CreepUtils } from "creep-utils";
import { Fixer } from "roles/fixer";
import { Harvester } from "roles/harvester";
import { Hauler } from "roles/hauler";
import { Importer } from "roles/importer";
import { MemoryUtils } from "planning/memory-utils";
import { RoomWrapper } from "structures/room-wrapper";
import { SockPuppetConstants } from "../config/sockpuppet-constants";
import { SpawnUtils } from "./spawn-utils";
import { SpawnWrapper } from "structures/spawn-wrapper";
import { TargetConfig } from "config/target-config";
import { Upgrader } from "roles/upgrader";
import { Worker } from "roles/worker";
import { profile } from "../../screeps-typescript-profiler";

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
    this.freeSpawns.forEach(s => {
      const spawnRequest = this.spawnQueue.pop();
      if (spawnRequest) {
        CreepUtils.consoleLogIfWatched(this.roomw, `spawning: ${JSON.stringify(spawnRequest)}`);
        s.spawn(spawnRequest);
      }
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

    // FIRST HAULER
    // always need at least one hauler to fill spawns and move harvesters
    if (this.creepCountsByRole[CreepRole.HAULER] === 0) {
      this.creepCountsByRole[CreepRole.HAULER] += 1;
      this.spawnQueue.push({
        bodyProfile: Hauler.BODY_PROFILE,
        role: Hauler.ROLE,
        priority: 100
      });
    }

    // BACKUP HAULER
    // spawn with max body
    const youngHaulers = this.roomw.find(FIND_MY_CREEPS, {
      filter: c => c.memory.role === Hauler.ROLE && c.ticksToLive && c.ticksToLive > 1000
    });
    CreepUtils.consoleLogIfWatched(this.roomw, `haulers: ${youngHaulers.length} younger than 1000`);
    if (youngHaulers.length === 0 && this.creepCountsByRole[CreepRole.HAULER] <= this.roomw.sources.length + 1) {
      this.creepCountsByRole[CreepRole.HAULER] += 1;
      this.spawnQueue.push({
        bodyProfile: Hauler.BODY_PROFILE,
        max: true,
        role: Hauler.ROLE,
        priority: 100
      });
    }

    // FIRST HARVESTER
    // always need at least one harvester
    if (this.creepCountsByRole[CreepRole.HARVESTER] === 0) {
      this.creepCountsByRole[CreepRole.HARVESTER] += 1;
      this.spawnQueue.push({
        bodyProfile: Harvester.BODY_PROFILE,
        role: Harvester.ROLE,
        priority: 90
      });
    }

    // HARVESTER
    // spawn enough harvesters to drain sources if they fit in harvest positions
    // don't count retiring harvesters, since they are being replaced
    const harvesters = this.roomw.find(FIND_MY_CREEPS, {
      filter: creep => creep.memory.role === Harvester.ROLE && !creep.memory.retiring
    });
    const harvesterWorkParts = CreepUtils.countParts(WORK, ...harvesters);
    const harvesterWorkPartsNeeded = this.roomw.sourcesEnergyCapacity / ENERGY_REGEN_TIME / HARVEST_POWER;
    const harvesterCount = this.creepCountsByRole[CreepRole.HARVESTER];
    const harvestPositionCount = this.roomw.harvestPositionCount;
    CreepUtils.consoleLogIfWatched(
      this.roomw,
      `harvesters: ${harvesterCount}/${harvestPositionCount} positions, ${harvesterWorkParts}/${harvesterWorkPartsNeeded} parts`
    );
    if (harvesterWorkParts < harvesterWorkPartsNeeded && harvesterCount < harvestPositionCount) {
      this.creepCountsByRole[CreepRole.HARVESTER] += 1;
      this.spawnQueue.push({
        bodyProfile: Harvester.BODY_PROFILE,
        max: true,
        role: Harvester.ROLE,
        priority: 90
      });
    }
    // replace aging harvester
    if (harvesterWorkParts <= harvesterWorkPartsNeeded && harvesterCount <= harvestPositionCount) {
      this.spawnReplacementMinder(Harvester);
    }

    // FIRST UPGRADER
    // start upgrading once harvesting efficiently
    if (this.creepCountsByRole[CreepRole.UPGRADER] === 0) {
      this.creepCountsByRole[CreepRole.UPGRADER] += 1;
      this.spawnQueue.push({
        bodyProfile: Upgrader.BODY_PROFILE,
        max: true,
        role: Upgrader.ROLE,
        priority: 80
      });
    }

    // UPGRADER
    // spawn enough upgraders to match source capacity
    const upgraderCount = this.creepCountsByRole[Upgrader.ROLE];
    // don't spawn upgraders during construction
    if (this.roomw.find(FIND_MY_CONSTRUCTION_SITES).length > 0 && upgraderCount > 0) {
      CreepUtils.consoleLogIfWatched(this.roomw, `skipping upgraders during construction`);
    } else {
      const upgradePositionCount = this.roomw.getUpgradePositions().length;
      const upgraderWorkPartsNeeded = this.getUpgraderWorkPartsNeeded();
      if (upgraderCount < upgradePositionCount) {
        const bodyProfile = this.buildBodyProfile(Upgrader.BODY_PROFILE, upgraderWorkPartsNeeded);
        this.creepCountsByRole[CreepRole.UPGRADER] += 1;
        this.spawnQueue.push({
          bodyProfile,
          role: Upgrader.ROLE,
          priority: 80
        });
      } else if (harvesterCount <= harvestPositionCount) {
        // replace aging upgrader
        this.spawnReplacementMinder(Upgrader);
      }
    }

    // HAULER
    // spawn enough haulers to keep up with hauling needed
    const haulerCount = this.creepCountsByRole[Hauler.ROLE];
    const sourcesPlusOne = this.roomw.sources.length + 1;
    CreepUtils.consoleLogIfWatched(this.roomw, `haulers: ${haulerCount}/${sourcesPlusOne}`);
    if (haulerCount < sourcesPlusOne) {
      this.creepCountsByRole[CreepRole.HAULER] += 1;
      this.spawnQueue.push({
        bodyProfile: Hauler.BODY_PROFILE,
        max: true,
        role: Hauler.ROLE,
        priority: 70
      });
    }
  }

  private spawnRemoteEconomy(): void {
    // IMPORTER
    const remoteHarvestRooms = TargetConfig.REMOTE_HARVEST[Game.shard.name].filter(name => {
      return !Game.rooms[name]?.controller?.my;
    });
    for (const roomName of remoteHarvestRooms) {
      const importersNeeded = this.calcImportersNeededForRoom(roomName);
      const importersOnRoom = _.filter(
        Game.creeps,
        creep => creep.memory.role === Importer.ROLE && creep.memory.targetRoom === roomName
      ).length;
      CreepUtils.consoleLogIfWatched(this.roomw, `importers for ${roomName}: ${importersOnRoom}/${importersNeeded}`);
      if (importersNeeded > importersOnRoom) {
        this.creepCountsByRole[CreepRole.IMPORTER] += 1;
        this.spawnQueue.push({
          bodyProfile: Importer.BODY_PROFILE,
          max: true,
          role: Importer.ROLE,
          targetRoom: roomName,
          priority: 50
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
        CreepUtils.consoleLogIfWatched(this.roomw, `claimer for ${roomName}: ${String(claimerOnRoom)}`);
        if (!claimerOnRoom) {
          this.creepCountsByRole[CreepRole.CLAIMER] += 1;
          this.spawnQueue.push({
            bodyProfile: Claimer.BODY_PROFILE,
            max: true,
            role: Claimer.ROLE,
            targetRoom: roomName,
            priority: 40
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
        room.controller?.owner.username === this.roomw.controller?.owner?.username &&
        room.find(FIND_MY_SPAWNS).length === 0
    );
    const remoteWorkers = _.filter(Game.creeps, creep => creep.memory.role === Worker.ROLE && creep.memory.targetRoom);
    if (remoteWorkers.length < noSpawnClaimedRooms.length) {
      const targetRoom = noSpawnClaimedRooms.find(
        room => !remoteWorkers.find(creep => creep.memory.targetRoom === room.name)
      );
      if (targetRoom) {
        this.creepCountsByRole[CreepRole.WORKER] += 1;
        this.spawnQueue.push({
          bodyProfile: Worker.BODY_PROFILE,
          max: true,
          role: Worker.ROLE,
          targetRoom: targetRoom.name,
          priority: 40
        });
      }
    }
  }

  private calcImportersNeededForRoom(roomName: string): number {
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
      roomMemory.controller?.owner ||
      roomMemory.controller?.reservation?.username !== this.roomw.controller?.owner?.username
    ) {
      return 0;
    }

    // spawn enough importers at current max size to maximize harvest
    const importerBody = SpawnUtils.getMaxBody(Importer.BODY_PROFILE, this.roomw);
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

    this.spawnRemoteEconomy();

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
        bodyProfile: this.buildBodyProfile(Builder.BODY_PROFILE, workPartsNeeded),
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

  private spawnReplacementMinder(type: typeof Upgrader | typeof Harvester): void {
    const creeps = this.roomw.find(FIND_MY_CREEPS, { filter: creep => creep.memory.role === type.ROLE });
    const ticksToReplace = SpawnUtils.calcReplacementTime(type.BODY_PROFILE, this.roomw);
    const oldestMinderIndex = creeps
      .filter(c => !c.memory.retiring && c.ticksToLive && c.ticksToLive <= ticksToReplace)
      .reduce((oldestIndex, c, index, array) => {
        const oldest = array[oldestIndex];
        if (!oldest || (c.ticksToLive && oldest.ticksToLive && c.ticksToLive < oldest.ticksToLive)) {
          return index;
        }
        return oldestIndex;
      }, -1);
    const oldestMinder = creeps[oldestMinderIndex];
    if (oldestMinder) {
      this.spawnQueue.push({
        bodyProfile: type.BODY_PROFILE,
        max: true,
        role: type.ROLE,
        replacing: oldestMinder.name,
        priority: 80
      });
      return;
    }
    return;
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

  private buildBodyProfile(bodyProfile: CreepBodyProfile, workPartsNeeded: number): CreepBodyProfile {
    const workPartsInProfile = bodyProfile.profile.filter(part => part === WORK).length;
    bodyProfile.maxBodyParts =
      (workPartsNeeded / workPartsInProfile) * bodyProfile.profile.length + bodyProfile.seed.length;
    return bodyProfile;
  }

  private getBuilderWorkPartsNeeded(): number {
    const conWork = this.roomw.constructionWork;
    const builders = this.roomw.find(FIND_MY_CREEPS, { filter: creep => creep.memory.role === CreepRole.BUILDER });
    const activeWorkParts = CreepUtils.countParts(WORK, ...builders);
    const workPartsNeeded = Math.ceil(conWork / SockPuppetConstants.WORK_PER_WORKER_PART);
    const workPartsDeficit = workPartsNeeded - activeWorkParts;
    return workPartsDeficit > 0 ? workPartsDeficit : 0;
  }

  private getUpgraderWorkPartsNeeded(): number {
    return this.roomw.sourcesEnergyCapacity / ENERGY_REGEN_TIME / UPGRADE_CONTROLLER_POWER;
  }
}
