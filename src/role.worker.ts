import { CreepUtils } from "creep-utils";

// TODO: pick up energy from tombstones and ruins
// TODO: specialized harvester dropping energy in container with better access around it
export class RoleWorker {
  public static run(creep: Creep): void {
    // harvest if any capacity in room
    if (creep.room.energyAvailable < creep.room.energyCapacityAvailable) {
      console.log('harvesting');
      this.harvest(creep);
    }
    // build if anything to build
    else if (creep.room.find(FIND_CONSTRUCTION_SITES).length > 0) {
      this.build(creep);
    }
    // otherwise upgrade
    else {
      this.upgrade(creep);
    }
  }

  // TODO: harvest if not full and closer to the energy source than the controller
  private static upgrade(creep: Creep): void {
    this.updateJob(creep, 'upgrading');
    this.stopWorkingIfEmpty(creep);
    this.startWorkingIfFull(creep, '⚡ upgrade');
    this.workOrHarvest(creep, function () {
      const controller = creep.room.controller;
      if (controller && creep.upgradeController(controller) == ERR_NOT_IN_RANGE) {
        creep.moveTo(controller, { visualizePathStyle: { stroke: '#ffffff' } });
      }
    });
  }

  // TODO: builder should repair too
  private static build(creep: Creep): void {
    this.updateJob(creep, 'building');
    this.stopWorkingIfEmpty(creep);
    this.startWorkingIfFull(creep, '🚧 build');
    this.workOrHarvest(creep, function () {
      let targets = creep.room.find(FIND_CONSTRUCTION_SITES);
      if (targets.length) {
        if (creep.build(targets[0]) == ERR_NOT_IN_RANGE) {
          creep.moveTo(targets[0], { visualizePathStyle: { stroke: '#ffffff' } });
        }
      }
    });
  }

  private static harvest(creep: Creep): void {
    this.updateJob(creep, 'harvesting');
    this.stopWorkingIfEmpty(creep);
    this.startWorkingIfFull(creep, '⚡ transfer');
    this.workOrHarvest(creep, function () {
      var targets = RoleWorker.findEnergyStorage(creep);
      if (targets.length > 0) {
        if (creep.transfer(targets[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
          creep.moveTo(targets[0], { visualizePathStyle: { stroke: '#ffffff' } });
        }
      }
    });
  }

  private static workOrHarvest(creep: Creep, work: Function) {
    if (creep.memory.working) {
      work();
    }
    else {
      CreepUtils.harvest(creep);
    }
  }

  private static updateJob(creep: Creep, job: string) {
    if (creep.memory.job != job) {
      creep.memory.job = job;
      creep.say(job);
    }
  }

  private static findEnergyStorage(creep: Creep): AnyStructure[] {
    return creep.room.find(FIND_STRUCTURES, {
      filter: (structure) => {
        return (structure.structureType == STRUCTURE_EXTENSION ||
          structure.structureType == STRUCTURE_SPAWN ||
          structure.structureType == STRUCTURE_TOWER) &&
          structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
      }
    });
  }

  private static stopWorkingIfEmpty(creep: Creep) {
    if (creep.memory.working && creep.store[RESOURCE_ENERGY] == 0) {
      creep.memory.working = false;
      creep.say('🔄 harvest');
    }
  }

  private static startWorkingIfFull(creep: Creep, message: string) {
    if (!creep.memory.working && creep.store.getFreeCapacity() == 0) {
      creep.memory.working = true;
      creep.say(message);
    }
  }
}
