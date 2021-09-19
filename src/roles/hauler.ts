import { CreepRole } from "config/creep-types";
import { SockPuppetConstants } from "config/sockpuppet-constants";
import { CreepUtils } from "creep-utils";
import { Builder } from "./builder";
import { CreepBodyProfile, CreepWrapper } from "./creep-wrapper";
import { Upgrader } from "./upgrader";

// TODO: assign to source containers or something so they don't only use closest
export class Hauler extends CreepWrapper {
  public static readonly ROLE = CreepRole.HAULER;
  public static readonly BODY_PROFILE: CreepBodyProfile = {
    profile: [MOVE, CARRY, CARRY],
    seed: [],
    maxBodyParts: 27
  };

  public run(): void {
    // work haul request
    this.checkForHaulRequest();
    if (this.memory.hauleeName) {
      CreepUtils.consoleLogIfWatched(this, `validate haul request `);
      const creepToHaul = Game.creeps[this.memory.hauleeName];
      if (creepToHaul && creepToHaul.memory.haulRequested) {
        const result = this.haulCreepJob(creepToHaul);
        CreepUtils.consoleLogIfWatched(this, `haul request result`, result);
        return;
      } else {
        this.memory.hauleeName = undefined;
        if (creepToHaul) {
          creepToHaul.memory.haulRequested = false;
          creepToHaul.memory.haulerName = undefined;
        }
      }
    }

    // supply spawn/extensions if any capacity in room
    if (this.room.energyAvailable < this.room.energyCapacityAvailable) {
      this.supplySpawnJob();
      return;
    }

    // TODO make tower supply prefer energy from storage
    // fill closest tower if any fall below threshold
    if (this.memory.job === "tower" || this.findTowersBelowThreshold().length > 0) {
      const target = this.findClosestTowerNotFull();
      if (target) {
        this.supplyStructureJob(target);
        return;
      }
    }

    // supply controller container
    const container = this.findClosestControllerContainerNotFull();
    if (container) {
      this.supplyStructureJob(container);
      return;
    }

    // supply empty builders
    const builders = this.room.find(FIND_MY_CREEPS, {
      filter: creep => creep.memory.role === Builder.ROLE && creep.store.getUsedCapacity() === 0
    });
    if (builders.length > 0) {
      this.supplyCreepsJob(builders);
      return;
    }

    // supply empty upgraders
    const upgraders = this.room.find(FIND_MY_CREEPS, {
      filter: creep => creep.memory.role === Upgrader.ROLE && creep.store.getUsedCapacity() === 0
    });
    if (upgraders.length > 0) {
      this.supplyCreepsJob(upgraders);
      return;
    }

    // otherwise supply storage
    if (this.room.storage) {
      this.supplyStructureJob(this.room.storage);
    }
  }

  private supplyCreepsJob(creeps: Creep[]) {
    CreepUtils.consoleLogIfWatched(this, `supply creeps`);
    this.updateJob(`creeps`);
    this.stopWorkingIfEmpty();
    this.startWorkingIfFull();

    if (this.memory.working) {
      CreepUtils.consoleLogIfWatched(this, "working");
      const target = creeps.find(creep => creep.pos.isNearTo(this.pos));
      if (target) {
        const transferResult = this.transfer(target, RESOURCE_ENERGY);
        CreepUtils.consoleLogIfWatched(this, `supply ${target.name} result`, transferResult);
        // stores do NOT reflect transfer above until next tick
        const targetFreeCap = target.store.getFreeCapacity(RESOURCE_ENERGY);
        const creepStoredEnergy = this.store.getUsedCapacity(RESOURCE_ENERGY);
        if (transferResult === OK && targetFreeCap >= creepStoredEnergy) {
          CreepUtils.consoleLogIfWatched(this, `empty`);
          const loadResult = this.loadEnergy();
          return loadResult;
        }
      }
      // get path through all creeps
      const goals = creeps.map(creep => {
        return { pos: creep.pos, range: 1 };
      });
      const path = PathFinder.search(this.pos, goals, {
        plainCost: 2,
        swampCost: 10,
        roomCallback: CreepUtils.getCreepMovementCostMatrix
      });
      CreepUtils.consoleLogIfWatched(this, `path: ${String(path.path)}`);
      const moveResult = this.moveByPath(path.path);
      CreepUtils.consoleLogIfWatched(this, `moving on path`, moveResult);
      return moveResult;
    } else {
      const loadResult = this.loadEnergy();
      return loadResult;
    }
  }

  private checkForHaulRequest() {
    if (!this.memory.hauleeName) {
      CreepUtils.consoleLogIfWatched(this, `checking haul queue`);
      const creepToHaul = this.room
        .find(FIND_MY_CREEPS, {
          filter: creep => creep.memory.haulRequested && !creep.memory.haulerName
        })
        .pop();
      if (creepToHaul) {
        CreepUtils.consoleLogIfWatched(this, `haul request for ${creepToHaul.name}`);
        this.memory.hauleeName = creepToHaul.name;
        creepToHaul.memory.haulerName = this.name;
      }
    }
  }

  private haulCreepJob(creep: Creep): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `haul ${creep.name}`);
    this.updateJob(`tug`);

    // this.startWorkingInRange(creep.pos, 1);
    if (this.pos.isNearTo(creep.pos)) {
      this.memory.working = true;
    } else {
      this.memory.working = false;
    }

    let result: ScreepsReturnCode;
    if (!this.memory.working) {
      // go find the creep to haul
      result = this.moveTo(creep);
      CreepUtils.consoleLogIfWatched(this, `move to creep`, result);
    }
    return OK;
  }

  private supplyStructureJob(target: StructureContainer | StructureTower | StructureStorage): ScreepsReturnCode {
    let result: ScreepsReturnCode = ERR_NOT_FOUND;
    CreepUtils.consoleLogIfWatched(this, `supply ${target.structureType}`);
    this.updateJob(`${target.structureType}`);
    this.stopWorkingIfEmpty();
    this.startWorkingIfFull();
    this.startWorkingInRange(target.pos, 1);

    if (this.memory.working) {
      CreepUtils.consoleLogIfWatched(this, "working");
      result = this.transfer(target, RESOURCE_ENERGY);
      CreepUtils.consoleLogIfWatched(this, `transfer result`, result);
      if (result === ERR_NOT_IN_RANGE) {
        result = this.moveTo(target, { range: 1, visualizePathStyle: { stroke: "#ffffff" } });
        CreepUtils.consoleLogIfWatched(this, `moving to ${target.structureType} at ${String(target.pos)}`, result);
      } else {
        // Stop if structure is full now
        let targetFreeCap = 0;
        // Type issue, two different versions of getFreeCapacity. The if makes compiler happy.
        if (target instanceof OwnedStructure) {
          targetFreeCap = target.store.getFreeCapacity(RESOURCE_ENERGY);
        } else {
          targetFreeCap = target.store.getFreeCapacity(RESOURCE_ENERGY);
        }
        const creepStoredEnergy = this.store.getUsedCapacity(RESOURCE_ENERGY);
        if (result === OK && targetFreeCap < creepStoredEnergy) {
          CreepUtils.consoleLogIfWatched(this, `${target.structureType} is full: ${String(target.pos)}`);
          this.updateJob("idle");
        }
      }
    } else {
      result = this.loadEnergy();
      // TODO when no energy found, try to work when partly full
    }
    return result;
  }

  // When supplying spawn, use priority to prefer storage
  private supplySpawnJob(): ScreepsReturnCode {
    const spawnStorage = this.findSpawnStorageNotFull();
    if (!spawnStorage) {
      return ERR_NOT_FOUND;
    }

    CreepUtils.consoleLogIfWatched(this, `supply for spawning`);
    this.updateJob(`spawn`);
    this.stopWorkingIfEmpty();
    this.startWorkingIfFull();

    if (this.memory.working) {
      CreepUtils.consoleLogIfWatched(this, "working");
      const target = spawnStorage.find(s => s.pos.isNearTo(this.pos));
      if (target) {
        const transferResult = this.transfer(target, RESOURCE_ENERGY);
        CreepUtils.consoleLogIfWatched(this, `supply ${target.structureType} result`, transferResult);
        // stores do NOT reflect transfer above until next tick
        const targetFreeCap = target.store.getFreeCapacity(RESOURCE_ENERGY);
        const creepStoredEnergy = this.store.getUsedCapacity(RESOURCE_ENERGY);
        if (transferResult === OK && targetFreeCap >= creepStoredEnergy) {
          CreepUtils.consoleLogIfWatched(this, `empty`);
          const harvestResult = this.harvestByPriority();
          return harvestResult;
        }
      }
      // get path through all extensions
      const goals = spawnStorage.map(s => {
        return { pos: s.pos, range: 1 };
      });
      const path = PathFinder.search(this.pos, goals, {
        plainCost: 2,
        swampCost: 10,
        roomCallback: CreepUtils.getCreepMovementCostMatrix
      });
      CreepUtils.consoleLogIfWatched(this, `path: ${String(path.path)}`);
      const moveResult = this.moveByPath(path.path);
      CreepUtils.consoleLogIfWatched(this, `moving on path`, moveResult);
      return moveResult;
    } else {
      const harvestResult = this.harvestByPriority();
      return harvestResult;
    }
  }

  private findTowersBelowThreshold(): StructureTower[] {
    const towers = this.roomw.towers;
    CreepUtils.consoleLogIfWatched(this, `towers: ${towers.length}`);

    const towersNotFull = towers.filter(tower => {
      return tower.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
    });
    CreepUtils.consoleLogIfWatched(this, `towers not full: ${towers.length}`);

    const towersBelowThreshold = towersNotFull.filter(tower => {
      return CreepUtils.getEnergyStoreRatioFree(tower) > SockPuppetConstants.TOWER_RESUPPLY_THRESHOLD;
    });
    CreepUtils.consoleLogIfWatched(this, `towers below threshold: ${towersBelowThreshold.length}`);

    return towersBelowThreshold;
  }

  private loadEnergy(): ScreepsReturnCode {
    if (this.getActiveBodyparts(CARRY) === 0 || this.store.getFreeCapacity() === 0) {
      return ERR_FULL;
    }

    this.pickupAdjacentDroppedEnergy();
    this.withdrawAdjacentRuinOrTombEnergy();

    let result = this.moveToAndGet(this.findClosestLargeEnergyDrop());
    if (result === OK) {
      return result;
    }

    result = this.moveToAndGet(this.findClosestSourceContainerNotEmpty());
    if (result === OK) {
      return result;
    }

    result = this.moveToAndGet(this.findClosestTombstoneWithEnergy());
    if (result === OK) {
      return result;
    }

    result = this.moveToAndGet(this.findClosestRuinsWithEnergy());
    if (result === OK) {
      return result;
    }

    if (this.room.storage && this.room.storage.store.energy > 0) {
      result = this.moveToAndGet(this.room.storage);
      if (result === OK) {
        return result;
      }
    }

    this.say("🤔");
    CreepUtils.consoleLogIfWatched(this, `stumped. Just going to sit here.`);
    return ERR_NOT_FOUND;
  }

  /** find a source container without a hauler id set */
  private claimSourceContainer(): Id<StructureContainer> | undefined {
    for (const sourceId in this.roomw.memory.sources) {
      const sourceInfo = this.roomw.memory.sources[sourceId];
      const containerId = sourceInfo.containerId;
      if (containerId && (!sourceInfo.haulerId || sourceInfo.haulerId === this.id)) {
        sourceInfo.haulerId = this.id;
        this.memory.containerId = containerId;
        return containerId;
      }
    }
    return undefined;
  }

  /** get container from my memory or claim one*/
  private getHome(): StructureContainer | StructureStorage | Source | undefined {
    if (this.memory.containerId) {
      const container = Game.getObjectById(this.memory.containerId);
      if (container) {
        return container;
      }
      this.memory.containerId = undefined;
      CreepUtils.consoleLogIfWatched(this, `container id invalid`);
    }

    if (this.memory.source) {
      const sourceInfo = this.roomw.memory.sources[this.memory.source];
      if (!sourceInfo) {
        this.memory.source = undefined;
        CreepUtils.consoleLogIfWatched(this, `source id invalid`);
        return undefined;
      }

      const containerId = sourceInfo.containerId;
      if (containerId && (!sourceInfo.minderId || sourceInfo.minderId === this.id)) {
        CreepUtils.consoleLogIfWatched(this, `claimed source container: ${containerId}`);
        const container = Game.getObjectById(containerId);
        if (container) {
          sourceInfo.minderId = this.id;
          this.memory.containerId = containerId;
          return container;
        }
        this.memory.containerId = undefined;
        CreepUtils.consoleLogIfWatched(this, `container id invalid`);
      }
    }

    CreepUtils.consoleLogIfWatched(this, `no free source containers`);
    return undefined;
  }
}
