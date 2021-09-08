import { CreepRole } from "config/creep-types";
import { SockPuppetConstants } from "config/sockpuppet-constants";
import { CreepUtils } from "creep-utils";
import { MemoryUtils } from "planning/memory-utils";
import { CreepWrapper } from "./creep-wrapper";

// TODO: assign to source containers or something so they don't only use closest
// TODO: get hauler to pull harvester to container
export class Hauler extends CreepWrapper {
  public static readonly ROLE = CreepRole.HAULER;
  public static readonly BODY_PROFILE: CreepBodyProfile = {
    profile: [MOVE, CARRY, CARRY],
    seed: [],
    maxBodyParts: 27
  };

  public run(): void {
    // check haul request queue
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

    // work haul request
    if (this.memory.hauleeName) {
      CreepUtils.consoleLogIfWatched(this, `validate haul request `);
      const creepToHaul = Game.creeps[this.memory.hauleeName];
      if (creepToHaul && creepToHaul.memory.haulRequested && creepToHaul.memory.destination) {
        const haulDestination = MemoryUtils.unpackRoomPosition(creepToHaul.memory.destination);
        const result = this.haulCreepJob(creepToHaul, haulDestination);
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

    // claim container if free
    if (!this.getMyContainer()) {
      const containerId = this.claimSourceContainer();
      if (containerId) {
        CreepUtils.consoleLogIfWatched(this, `claimed source container: ${String(containerId)}`);
      }
      CreepUtils.consoleLogIfWatched(this, `no free containers`);
    }

    // supply spawn/extensions if any capacity in room
    if (this.room.energyAvailable < this.room.energyCapacityAvailable) {
      const target = this.findClosestSpawnStorageNotFull();
      if (target) {
        this.supplySpawnJob(target);
        return;
      }
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

    // supply controller
    const container = this.findClosestControllerContainerNotFull();
    if (container) {
      this.supplyStructureJob(container);
      return;
    }

    // otherwise supply storage
    if (this.room.storage) {
      this.supplyStructureJob(this.room.storage);
    }
  }

  private haulCreepJob(creep: Creep, target: RoomPosition): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `haul ${creep.name}`);
    this.updateJob(`tug`);

    // this.startWorkingInRange(creep.pos, 1);
    if (this.pos.isNearTo(creep.pos)) {
      this.memory.working = true;
    } else {
      this.memory.working = false;
    }

    let result: ScreepsReturnCode;
    if (this.memory.working) {
      // try to pull
      CreepUtils.consoleLogIfWatched(this, "working");
      result = this.pull(creep);
      CreepUtils.consoleLogIfWatched(this, `pull result`, result);
      result = creep.move(this);
      CreepUtils.consoleLogIfWatched(this, `creep move result`, result);

      // move toward target
      if (result === OK && !this.pos.isEqualTo(target)) {
        result = this.moveTo(target);
        CreepUtils.consoleLogIfWatched(this, `move result`, result);
      }

      // swap positions with creep
      if (result === OK && this.pos.isEqualTo(target)) {
        result = this.moveTo(creep);
        CreepUtils.consoleLogIfWatched(this, `last move`, result);
      }
    } else {
      // go find the creep to haul
      result = this.moveTo(creep);
      CreepUtils.consoleLogIfWatched(this, `move result`, result);
    }
    return result;
  }

  private supplyStructureJob(
    target: StructureSpawn | StructureExtension | StructureContainer | StructureTower | StructureStorage
  ): ScreepsReturnCode {
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
      // this causes a loop, find a better way
      // if (result === ERR_NOT_FOUND) {
      //   // nowhere to get energy - start working if not empty
      //   if (this.store.energy > 0) {
      //     this.memory.working = true;
      //     CreepUtils.consoleLogIfWatched(this, "no energy to load, start working");
      //     result = this.supplyStructure(target);
      //   }
      // }
    }
    return result;
  }

  // When supplying spawn, use priority to prefer storage
  private supplySpawnJob(target: StructureSpawn | StructureExtension): ScreepsReturnCode {
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
        const targetFreeCap = target.store.getFreeCapacity(RESOURCE_ENERGY);
        const creepStoredEnergy = this.store.getUsedCapacity(RESOURCE_ENERGY);
        if (result === OK && targetFreeCap < creepStoredEnergy) {
          CreepUtils.consoleLogIfWatched(this, `${target.structureType} is full: ${String(target.pos)}`);
          this.updateJob("idle");
        }
      }
    } else {
      result = this.harvestByPriority();
      // TODO when no energy found, try to work when partly full
      // this causes a loop, find a better way
      // if (result === ERR_NOT_FOUND) {
      //   // nowhere to get energy - start working if not empty
      //   if (this.store.energy > 0) {
      //     this.memory.working = true;
      //     CreepUtils.consoleLogIfWatched(this, "no energy to load, start working");
      //     result = this.supplyStructure(target);
      //   }
      // }
    }
    return result;
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

  private withdrawAdjacentRuinOrTombEnergy(): ScreepsReturnCode {
    // can't withdraw twice, so prefer emptying tombstones because they decay faster
    let withdrawResult: ScreepsReturnCode = ERR_NOT_FOUND;
    const tombs = this.pos.findInRange(FIND_TOMBSTONES, 1, {
      filter: t => t.store.getUsedCapacity(RESOURCE_ENERGY) > 0
    });
    if (tombs.length > 0) {
      withdrawResult = this.withdraw(tombs[0], RESOURCE_ENERGY);
    } else {
      const ruins = this.pos.findInRange(FIND_RUINS, 1, { filter: r => r.store.getUsedCapacity(RESOURCE_ENERGY) > 0 });
      if (ruins.length > 0) {
        withdrawResult = this.withdraw(ruins[0], RESOURCE_ENERGY);
      }
    }
    return withdrawResult;
  }

  private pickupAdjacentDroppedEnergy(): ScreepsReturnCode {
    let pickupResult: ScreepsReturnCode = ERR_NOT_FOUND;
    const resources = this.pos.findInRange(FIND_DROPPED_RESOURCES, 1, {
      filter: r => r.resourceType === RESOURCE_ENERGY
    });
    if (resources.length > 0) {
      pickupResult = this.pickup(resources[0]);
    }
    return pickupResult;
  }

  private loadEnergy(): ScreepsReturnCode {
    this.pickupAdjacentDroppedEnergy();
    this.withdrawAdjacentRuinOrTombEnergy();

    const tombstone = this.findClosestTombstoneWithEnergy();
    const ruin = this.findClosestRuinsWithEnergy();
    const droppedEnergy = this.findClosestDroppedEnergy();

    const myContainer = this.getMyContainer();
    if (myContainer && myContainer.store.energy > 0) {
      CreepUtils.consoleLogIfWatched(this, `moving to my container: ${myContainer.pos.x},${myContainer.pos.y}`);
      return this.moveToAndWithdraw(myContainer);
    }

    const container = this.findClosestSourceContainerNotEmpty();
    if (container) {
      CreepUtils.consoleLogIfWatched(this, `moving to container: ${container.pos.x},${container.pos.y}`);
      return this.moveToAndWithdraw(container);
    }

    if (tombstone) {
      CreepUtils.consoleLogIfWatched(this, `moving to tombstone: ${tombstone.pos.x},${tombstone.pos.y}`);
      return this.moveToAndWithdraw(tombstone);
    }

    if (ruin) {
      CreepUtils.consoleLogIfWatched(this, `moving to ruin: ${ruin.pos.x},${ruin.pos.y}`);
      return this.moveToAndWithdraw(ruin);
    }

    if (droppedEnergy) {
      CreepUtils.consoleLogIfWatched(this, `moving to ruin: ${droppedEnergy.pos.x},${droppedEnergy.pos.y}`);
      return this.moveToAndPickup(droppedEnergy);
    }

    const storage = this.room.storage;
    if (storage) {
      CreepUtils.consoleLogIfWatched(this, `moving to storage: ${String(storage.pos)}`);
      return this.moveToAndWithdraw(storage);
    }

    if (myContainer) {
      CreepUtils.consoleLogIfWatched(this, `moving to my container: ${String(myContainer)}`);
      return this.moveToAndWithdraw(myContainer);
    }

    this.say("🤔");
    CreepUtils.consoleLogIfWatched(this, `stumped. Just going to sit here.`);
    return ERR_NOT_FOUND;
  }

  protected claimSourceContainer(): Id<StructureContainer> | undefined {
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
}
