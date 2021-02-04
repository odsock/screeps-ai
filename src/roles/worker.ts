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
    // TODO: repair if no towers to do it
    // repair if anything to repair
    // else if (creep.room.find(FIND_STRUCTURES, { filter: (structure) => structure.hits < structure.hitsMax }).length > 0) {
    //   this.repair(creep);
    // }
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
          creep.moveTo(controller, { visualizePathStyle: { stroke: '#ffffff' } });
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
    // don't check if full/empty
    if (creep.store.getUsedCapacity() != 0 && creep.store.getFreeCapacity() != 0) {
      // don't check if can work from here
      if (creep.pos.inRangeTo(jobsite, 3)) {
        return;
      }

      // skip check if no source or next to source already
      const source = CreepUtils.findClosestEnergySource(creep);
      if (!source || creep.pos.isNearTo(source)) {
        return;
      }

      // calculate effiency of heading back to refill, then going to job site
      const sourceCost = PathFinder.search(creep.pos, { pos: source.pos, range: 1 }).cost;
      console.log(`sourceCost: ${sourceCost}`);
      // subtract one from runCost because you cannot stand on the source
      let runCost = PathFinder.search(source.pos, { pos: jobsite, range: 3 }).cost;
      if (runCost > 1) {
        runCost = runCost - 1;
      }
      console.log(`runCost: ${runCost}`);
      const refillEfficiency = sourceCost + runCost;
      console.log(`refillEfficiency: ${refillEfficiency}`);

      // calculate effiency of going to job site partially full
      const jobsiteCost = PathFinder.search(creep.pos, { pos: jobsite, range: 3 }).cost;
      console.log(`jobsiteCost: ${jobsiteCost}`);
      const storeRatio = creep.store.getUsedCapacity() / creep.store.getCapacity();
      console.log(`storeRatio: ${storeRatio}`);
      const jobsiteEfficiency = jobsiteCost / storeRatio;
      console.log(`jobsiteEfficiency: ${jobsiteEfficiency}`);

      // compare cost/energy delivered working vs refilling first
      if (jobsiteEfficiency < refillEfficiency) {
        console.log(`close to site: starting work`);
        creep.memory.working = true;
      }
      else {
        console.log(`close to source: stopping work`);
        creep.memory.working = false;
      }
    }
  }
}
