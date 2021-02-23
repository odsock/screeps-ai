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
      CreepUtils.workIfCloseToJobsite(creep, creep.room.controller.pos);
      this.workOrHarvest(creep, function () {
        if (creep.upgradeController(controller) == ERR_NOT_IN_RANGE) {
          creep.moveTo(controller, { visualizePathStyle: { stroke: '#ffffff' } });
        }
      });
    }
  }

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
      CreepUtils.workIfCloseToJobsite(creep, site.pos);
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
      CreepUtils.workIfCloseToJobsite(creep, site.pos);
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
}
