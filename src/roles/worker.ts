import { CreepUtils } from "creep-utils";
import config from "../constants";
import { CreepWrapper } from "./creep-wrapper";

export class Worker extends CreepWrapper {
  public run(): void {
    super.run();
    
    // harvest if any capacity in room
    if (this.room.energyAvailable < this.room.energyCapacityAvailable) {
      CreepUtils.consoleLogIfWatched(this, 'harvesting job');
      this.harvestByPriority();
      return;
    }

    // supply tower if half empty
    const tower = this.findClosestTowerNotFull();
    if (tower) {
      const towerPercentFree = CreepUtils.getEnergyStoreRatioFree(tower);
      CreepUtils.consoleLogIfWatched(this, `towerPercentFree: ${towerPercentFree}`);
      if (this.memory.job == 'supply' || towerPercentFree > .5) {
        CreepUtils.consoleLogIfWatched(this, 'supply job');
        this.doSupplyJob();
        return;
      }
    }

    // build if anything to build
    if (this.findConstructionSites().length > 0) {
      CreepUtils.consoleLogIfWatched(this, 'building job');
      this.doBuildJob();
      return;
    }

    const towerCount = this.findTowers().length;
    const repairSiteCount = this.findRepairSites().length;
    // repair if no towers to do it
    CreepUtils.consoleLogIfWatched(this, `towers: ${towerCount}, repair sites: ${repairSiteCount}`)
    if (towerCount == 0 && repairSiteCount > 0) {
      CreepUtils.consoleLogIfWatched(this, 'repairing job');
      this.doRepairJob();
      return;
    }

    // otherwise upgrade
    CreepUtils.consoleLogIfWatched(this, 'upgrading job');
    this.doUpgradeJob();
  }

  private doUpgradeJob(): void {
    if (this.room.controller) {
      const controller = this.room.controller;
      this.updateJob('upgrading');
      this.stopWorkingIfEmpty();
      this.startWorkingIfFull('⚡ upgrade');
      this.workIfCloseToJobsite(this.room.controller.pos);

      if (this.memory.working) {
        if (this.upgradeController(controller) == ERR_NOT_IN_RANGE) {
          this.moveTo(controller, { visualizePathStyle: { stroke: '#ffffff' } });
        }
      }
      else {
        this.harvestByPriority();
      }
    }
  }

  private doBuildJob(): void {
    let site: ConstructionSite | null = null;
    for (let i = 0; !site && i < config.CONSTRUCTION_PRIORITY.length; i++) {
      site = this.pos.findClosestByPath(FIND_MY_CONSTRUCTION_SITES, {
        filter: (s) => s.structureType == config.CONSTRUCTION_PRIORITY[i]
      });
    }
    if (!site) {
      site = this.pos.findClosestByPath(FIND_MY_CONSTRUCTION_SITES);
    }

    if (site) {
      this.updateJob('building');
      this.stopWorkingIfEmpty();
      this.startWorkingIfFull('🚧 build');
      this.workIfCloseToJobsite(site.pos);

      if (this.memory.working) {
        // don't block the source while working
        const closestEnergySource = this.findClosestActiveEnergySource();
        if (closestEnergySource?.pos && this.pos.isNearTo(closestEnergySource)) {
          const path = PathFinder.search(this.pos, { pos: closestEnergySource.pos, range: 2 }, { flee: true });
          this.moveByPath(path.path);
        }
        else if (this.build(site as ConstructionSite) == ERR_NOT_IN_RANGE) {
          this.moveTo(site as ConstructionSite, { visualizePathStyle: { stroke: '#ffffff' } });
        }
      }
      else {
        this.harvestByPriority();
      }
    }
  }

  private doRepairJob(): void {
    const site = this.pos.findClosestByPath(FIND_STRUCTURES, { filter: (structure) => structure.hits < structure.hitsMax });
    if (site) {
      this.updateJob('repairing');
      this.stopWorkingIfEmpty();
      this.startWorkingIfFull('🚧 repair');
      this.workIfCloseToJobsite(site.pos);

      if (this.memory.working) {
        if (this.repair(site) == ERR_NOT_IN_RANGE) {
          this.moveTo(site, { visualizePathStyle: { stroke: '#ffffff' } });
        }
      }
      else {
        this.harvestByPriority();
      }
    }
  }

  private doHarvestJob(): void {
    this.updateJob('harvesting');
    this.stopWorkingIfEmpty();
    this.startWorkingIfFull('⚡ transfer');

    if (this.memory.working) {
      const site = this.findClosestEnergyStorageNotFull();
      if (site) {
        if (this.transfer(site, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
          this.moveTo(site, { visualizePathStyle: { stroke: '#ffffff' } });
        }
      }
    }
    else {
      this.harvestByPriority();
    }
  }

  private doSupplyJob(): void {
    this.updateJob('supply');
    this.stopWorkingIfEmpty();
    this.startWorkingIfFull('⚡ supply');

    if (this.memory.working) {
      const site = this.findClosestTowerNotFull();
      if (site) {
        if (this.transfer(site, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
          this.moveTo(site, { visualizePathStyle: { stroke: '#ffffff' } });
        }
      }
      else {
        this.memory.job = '';
      }
    }
    else {
      this.harvestByPriority();
    }
  }
}
