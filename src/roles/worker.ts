import { CreepUtils } from "creep-utils";
import config from "../constants";


// TODO: make worker not static
export class Worker {
  public static run(creep: Creep): void {
    // harvest if any capacity in room
    if (creep.room.energyAvailable < creep.room.energyCapacityAvailable) {
      CreepUtils.consoleLogIfWatched(creep, 'harvesting job');
      this.harvest(creep);
      return;
    }

    // supply tower if half empty
    const tower = CreepUtils.findClosestTowerWithStorage(creep);
    if (tower) {
      const towerPercentFree = CreepUtils.getEnergyStorePercentFree(tower);
      CreepUtils.consoleLogIfWatched(creep, `towerPercentFree: ${towerPercentFree}`);
      if (creep.memory.job == 'supply' || towerPercentFree > .5) {
        CreepUtils.consoleLogIfWatched(creep, 'supply job');
        this.supply(creep);
        return;
      }
    }

    // build if anything to build
    if (CreepUtils.findConstructionSites(creep).length > 0) {
      CreepUtils.consoleLogIfWatched(creep, 'building job');
      this.build(creep);
      return;
    }

    const towerCount = CreepUtils.findTowers(creep).length;
    const repairSiteCount = CreepUtils.findRepairSites(creep).length;
    // repair if no towers to do it
    CreepUtils.consoleLogIfWatched(creep, `towers: ${towerCount}, repair sites: ${repairSiteCount}`)
    if (towerCount == 0 && repairSiteCount > 0) {
      CreepUtils.consoleLogIfWatched(creep, 'repairing job');
      this.repair(creep);
      return;
    }

    // otherwise upgrade
    CreepUtils.consoleLogIfWatched(creep, 'upgrading job');
    this.upgrade(creep);
  }

  private static upgrade(creep: Creep): void {
    if (creep.room.controller) {
      const controller = creep.room.controller;
      CreepUtils.updateJob(creep, 'upgrading');
      CreepUtils.stopWorkingIfEmpty(creep);
      CreepUtils.startWorkingIfFull(creep, '⚡ upgrade');
      this.workIfCloseToJobsite(creep, creep.room.controller.pos);
      this.workOrHarvest(creep, function () {
        if (creep.upgradeController(controller) == ERR_NOT_IN_RANGE) {
          creep.moveTo(controller, { visualizePathStyle: { stroke: '#ffffff' } });
        }
      });
    }
  }

  // TODO: build with priority on extensions, not roads
  private static build(creep: Creep): void {
    let site: ConstructionSite | null = null;
    for (let i = 0; !site && i < config.CONSTRUCTION_PRIORITY.length; i++) {
      site = creep.pos.findClosestByPath(FIND_MY_CONSTRUCTION_SITES, {
        filter: (s) => s.structureType == config.CONSTRUCTION_PRIORITY[i]
      });
    }
    if (!site) {
      site = creep.pos.findClosestByPath(FIND_MY_CONSTRUCTION_SITES);
    }

    if (site) {
      CreepUtils.updateJob(creep, 'building');
      CreepUtils.stopWorkingIfEmpty(creep);
      CreepUtils.startWorkingIfFull(creep, '🚧 build');
      this.workIfCloseToJobsite(creep, site.pos);
      this.workOrHarvest(creep, function () {
        // don't block the source while working
        const closestEnergySource = CreepUtils.findClosestActiveEnergySource(creep);
        if (closestEnergySource?.pos && creep.pos.isNearTo(closestEnergySource)) {
          const path = PathFinder.search(creep.pos, { pos: closestEnergySource.pos, range: 2 }, { flee: true });
          creep.moveByPath(path.path);
        }
        else if (creep.build(site as ConstructionSite) == ERR_NOT_IN_RANGE) {
          creep.moveTo(site as ConstructionSite, { visualizePathStyle: { stroke: '#ffffff' } });
        }
      });
    }
  }

  private static repair(creep: Creep): void {
    const site = creep.pos.findClosestByPath(FIND_STRUCTURES, { filter: (structure) => structure.hits < structure.hitsMax });
    if (site) {
      CreepUtils.updateJob(creep, 'repairing');
      CreepUtils.stopWorkingIfEmpty(creep);
      CreepUtils.startWorkingIfFull(creep, '🚧 repair');
      this.workIfCloseToJobsite(creep, site.pos);
      this.workOrHarvest(creep, function () {
        if (creep.repair(site) == ERR_NOT_IN_RANGE) {
          creep.moveTo(site, { visualizePathStyle: { stroke: '#ffffff' } });
        }
      });
    }
  }

  private static harvest(creep: Creep): void {
    CreepUtils.updateJob(creep, 'harvesting');
    CreepUtils.stopWorkingIfEmpty(creep);
    CreepUtils.startWorkingIfFull(creep, '⚡ transfer');
    this.workOrHarvest(creep, function () {
      const site = CreepUtils.findClosestEnergyStorageNotFull(creep);
      if (site) {
        if (creep.transfer(site, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
          creep.moveTo(site, { visualizePathStyle: { stroke: '#ffffff' } });
        }
      }
    });
  }

  private static supply(creep: Creep): void {
    CreepUtils.updateJob(creep, 'supply');
    CreepUtils.stopWorkingIfEmpty(creep);
    CreepUtils.startWorkingIfFull(creep, '⚡ supply');
    this.workOrHarvest(creep, function () {
      const site = CreepUtils.findClosestTowerWithStorage(creep);
      if (site) {
        if (creep.transfer(site, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
          creep.moveTo(site, { visualizePathStyle: { stroke: '#ffffff' } });
        }
      }
      else {
        creep.memory.job = '';
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

  /**
   * @description Decides if creep should work, or harvest, based on store and position
   * @param creep
   * @param jobsite
   */
  private static workIfCloseToJobsite(creep: Creep, jobsite: RoomPosition) {
    // skip check if full/empty
    if (creep.store.getUsedCapacity() != 0 && creep.store.getFreeCapacity() != 0) {
      // skip check if can work from here
      if (creep.pos.inRangeTo(jobsite, 3)) {
        return;
      }
      // skip check if no source or next to source already
      const source = CreepUtils.findClosestActiveEnergySource(creep);
      if (!source || creep.pos.isNearTo(source)) {
        return;
      }

      // calculate effiency of heading back to refill, then going to job site
      const sourceCost = PathFinder.search(creep.pos, { pos: source.pos, range: 1 }).cost;
      CreepUtils.consoleLogIfWatched(creep, `sourceCost: ${sourceCost}`);
      // subtract one from runCost because you cannot stand on the source
      let runCost = PathFinder.search(source.pos, { pos: jobsite, range: 3 }).cost;
      if (runCost > 1) {
        runCost = runCost - 1;
      }
      CreepUtils.consoleLogIfWatched(creep, `runCost: ${runCost}`);
      const refillEfficiency = sourceCost + runCost;
      CreepUtils.consoleLogIfWatched(creep, `refillEfficiency: ${refillEfficiency}`);

      // calculate effiency of going to job site partially full
      const jobsiteCost = PathFinder.search(creep.pos, { pos: jobsite, range: 3 }).cost;
      CreepUtils.consoleLogIfWatched(creep, `jobsiteCost: ${jobsiteCost}`);
      const storeRatio = creep.store.getUsedCapacity() / creep.store.getCapacity();
      CreepUtils.consoleLogIfWatched(creep, `storeRatio: ${storeRatio}`);
      const jobsiteEfficiency = jobsiteCost / storeRatio;
      CreepUtils.consoleLogIfWatched(creep, `jobsiteEfficiency: ${jobsiteEfficiency}`);

      // compare cost/energy delivered working vs refilling first
      if (jobsiteEfficiency < refillEfficiency) {
        CreepUtils.consoleLogIfWatched(creep, `close to site: starting work`);
        creep.memory.working = true;
      }
      else {
        CreepUtils.consoleLogIfWatched(creep, `close to source: stopping work`);
        creep.memory.working = false;
      }
    }
  }
}
