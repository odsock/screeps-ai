import { CreepUtils } from "creep-utils";

export class Worker {
  public static run(creep: Creep): void {
    // harvest if any capacity in room
    if (creep.room.energyAvailable < creep.room.energyCapacityAvailable) {
      this.harvest(creep);
    }
    // build if anything to build
    else if (creep.room.find(FIND_CONSTRUCTION_SITES).length > 0) {
      this.build(creep);
    }
    // repair if anything to repair
    else if (creep.room.find(FIND_STRUCTURES, { filter: (structure) => structure.hits < structure.hitsMax }).length > 0) {
      this.repair(creep);
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

  // TODO: make builder move away from energy source if working
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

  private static repair(creep: Creep): void {
    this.updateJob(creep, 'repairing');
    this.stopWorkingIfEmpty(creep);
    this.startWorkingIfFull(creep, '🚧 repair');
    this.workOrHarvest(creep, function () {
      let repairSites = creep.room.find(FIND_STRUCTURES, { filter: (structure) => structure.hits < structure.hitsMax });
      if (repairSites.length) {
        if (creep.repair(repairSites[0]) == ERR_NOT_IN_RANGE) {
          creep.moveTo(repairSites[0], { visualizePathStyle: { stroke: '#ffffff' } });
        }
      }
    });
  }

  private static harvest(creep: Creep): void {
    this.updateJob(creep, 'harvesting');
    this.stopWorkingIfEmpty(creep);
    this.startWorkingIfFull(creep, '⚡ transfer');
    this.workOrHarvest(creep, function () {
      var targets = Worker.findEnergyStorage(creep);
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
      creep.memory.working = false;
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
