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

  private static upgrade(creep: Creep): void {
    if (creep.room.controller) {
      const controller = creep.room.controller;
      this.updateJob(creep, 'upgrading');
      this.stopWorkingIfEmpty(creep);
      this.startWorkingIfFull(creep, '⚡ upgrade');
      this.workIfCloseToJobsite(creep, creep.room.controller.pos);
      this.workOrHarvest(creep, function () {
        if (creep.upgradeController(controller) == ERR_NOT_IN_RANGE) {
          if(creep.room.memory.controllerRoads?.complete == true) {
            // TODO: reference source by id rather than array index
            creep.moveByPath(creep.room.memory.controllerRoads.paths[0].path);
          }
          else {
            creep.moveTo(controller, { visualizePathStyle: { stroke: '#ffffff' } });
          }
        }
      });
    }
  }

  // TODO: make builder move away from energy source if working
  private static build(creep: Creep): void {
    const site = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
    if (site) {
      this.updateJob(creep, 'building');
      this.stopWorkingIfEmpty(creep);
      this.startWorkingIfFull(creep, '🚧 build');
      this.workIfCloseToJobsite(creep, site.pos);
      this.workOrHarvest(creep, function () {
        if (creep.build(site) == ERR_NOT_IN_RANGE) {
          creep.moveTo(site, { visualizePathStyle: { stroke: '#ffffff' } });
        }
      });
    }
  }

  private static repair(creep: Creep): void {
    const site = creep.pos.findClosestByPath(FIND_STRUCTURES, { filter: (structure) => structure.hits < structure.hitsMax });
    if (site) {
      this.updateJob(creep, 'repairing');
      this.stopWorkingIfEmpty(creep);
      this.startWorkingIfFull(creep, '🚧 repair');
      this.workIfCloseToJobsite(creep, site.pos);
      this.workOrHarvest(creep, function () {
        if (creep.repair(site) == ERR_NOT_IN_RANGE) {
          creep.moveTo(site, { visualizePathStyle: { stroke: '#ffffff' } });
        }
      });
    }
  }

  private static harvest(creep: Creep): void {
    this.updateJob(creep, 'harvesting');
    this.stopWorkingIfEmpty(creep);
    this.startWorkingIfFull(creep, '⚡ transfer');
    this.workOrHarvest(creep, function () {
      const site = Worker.findClosestEnergyStorage(creep);
      if (site) {
        if (creep.transfer(site, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
          creep.moveTo(site, { visualizePathStyle: { stroke: '#ffffff' } });
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

  private static findClosestEnergyStorage(creep: Creep): AnyStructure | null {
    return creep.pos.findClosestByPath(FIND_STRUCTURES, {
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

  /**
   * @description Decides if creep should work, or harvest, based on store and position
   * @param creep 
   * @param jobsite 
   */
  private static workIfCloseToJobsite(creep: Creep, jobsite: RoomPosition) {
    if (creep.store.getUsedCapacity() != 0) {
      const source = CreepUtils.findClosestEnergySource(creep);
      if (source) {
        const sourceCost = PathFinder.search(creep.pos, source.pos).cost;
        const jobsiteCost = PathFinder.search(creep.pos, jobsite).cost;
        const storeRatio = creep.store.getUsedCapacity() / creep.store.getCapacity();
        // compare cost/energy delivered working vs refilling first
        if ((1 - jobsiteCost) / storeRatio < (sourceCost + 1)) {
          creep.memory.working = true;
        }
        else {
          creep.memory.working = false;
        }
      }
    }
  }
}
