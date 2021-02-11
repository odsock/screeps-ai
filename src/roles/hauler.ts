import { CreepUtils } from "creep-utils";

export class Hauler {
  constructor(private readonly creep: Creep) { }

  private readonly TOWER_SUPPLY_THRESHOLD = .5;

  public run() {
    // supply spawn/extensions if any capacity in room
    if (this.creep.room.energyAvailable < this.creep.room.energyCapacityAvailable) {
      CreepUtils.consoleLogIfWatched(this.creep, 'supply spawn job');
      this.supplySpawn(this.creep);
      return;
    }

    // supply tower if half empty
    const tower = CreepUtils.findClosestTowerWithStorage(this.creep);
    if (tower) {
      const towerPercentFree = CreepUtils.getEnergyStorePercentFree(tower);
      CreepUtils.consoleLogIfWatched(this.creep, `towerPercentFree: ${towerPercentFree}`);
      if (this.creep.memory.job == 'tower' || towerPercentFree > this.TOWER_SUPPLY_THRESHOLD) {
        CreepUtils.consoleLogIfWatched(this.creep, 'supply tower job');
        this.supplyTower(this.creep);
        return;
      }
    }

    // otherwise supply controller
    this.supplyController();
  }
  
  private supplyController() {
    const controllerContainer = this.findClosestControllerContainerNotFull();
    const sourceContainer = this.findClosestSourceContainerNotEmpty();
    if (controllerContainer && sourceContainer) {
      CreepUtils.updateJob(this.creep, 'controller');
      CreepUtils.stopWorkingIfEmpty(this.creep);
      CreepUtils.startWorkingIfFull(this.creep, '⚡ controller');

      if (this.creep.memory.working) {
        if (this.creep.transfer(controllerContainer, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
          this.creep.moveTo(controllerContainer, { visualizePathStyle: { stroke: '#ffffff' } });
        }
      }
      else {
        if (this.creep.withdraw(sourceContainer, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
          this.creep.moveTo(sourceContainer, { visualizePathStyle: { stroke: '#ffffff' } });
        }
      }
    }
  }

  private supplySpawn(creep: Creep): void {
    CreepUtils.updateJob(creep, 'spawn');
    CreepUtils.stopWorkingIfEmpty(creep);
    CreepUtils.startWorkingIfFull(creep, '⚡ spawn');
    this.workOrHarvest(creep, function () {
      const site = CreepUtils.findClosestEnergyStorageNotFull(creep);
      if (site) {
        if (creep.transfer(site, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
          creep.moveTo(site, { visualizePathStyle: { stroke: '#ffffff' } });
        }
      }
    });
  }

  private supplyTower(creep: Creep): void {
    CreepUtils.updateJob(creep, 'tower');
    CreepUtils.stopWorkingIfEmpty(creep);
    CreepUtils.startWorkingIfFull(creep, '⚡ tower');
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

  private workOrHarvest(creep: Creep, work: Function) {
    if (creep.memory.working) {
      work();
    }
    else {
      this.loadEnergy();
    }
  }

  private findClosestControllerContainerNotFull(): StructureContainer | null {
    let containers: StructureContainer[] = [];
    if (this.creep.room.controller) {
      containers = this.creep.room.controller.pos.findInRange(FIND_STRUCTURES, 3, {
        filter: (s) => s.structureType == STRUCTURE_CONTAINER && s.store.getFreeCapacity() > 0
      }) as StructureContainer[];
    }
    return this.creep.pos.findClosestByPath(containers);
  }

  private findClosestSourceContainerNotEmpty(): StructureContainer | null {
    const sources = this.creep.room.find(FIND_SOURCES);
    let containers: StructureContainer[] = [];
    if (sources.length > 0) {
      for (let i = 0; i < sources.length; i++) {
        const container = sources[i].pos.findInRange(FIND_STRUCTURES, 1, {
          filter: (s) => s.structureType == STRUCTURE_CONTAINER && s.store.getUsedCapacity() > 0
        });
        if (container.length > 0) {
          containers.push(container[0] as StructureContainer);
        }
      }
    }
    return this.creep.pos.findClosestByPath(containers);
  }

  private loadEnergy(): void {
    // harvest if adjacent to tombstone or ruin
    const tombstone = CreepUtils.findClosestTombstoneWithEnergy(this.creep);
    if (tombstone) {
      if (this.creep.withdraw(tombstone, RESOURCE_ENERGY) == OK) {
        return;
      }
    }
    const ruin = CreepUtils.findClosestRuinsWithEnergy(this.creep);
    if (ruin) {
      if (this.creep.withdraw(ruin, RESOURCE_ENERGY) == OK) {
        return;
      }
    }

    let container = CreepUtils.findClosestContainerWithEnergy(this.creep);
    if (container) {
      CreepUtils.consoleLogIfWatched(this.creep, `moving to container: ${container.pos.x},${container.pos.y}`);
      CreepUtils.withdrawEnergyFromOrMoveTo(this.creep, container);
      return;
    }

    if (tombstone) {
      CreepUtils.consoleLogIfWatched(this.creep, `moving to tombstone: ${tombstone.pos.x},${tombstone.pos.y}`);
      CreepUtils.withdrawEnergyFromOrMoveTo(this.creep, tombstone);
      return;
    }

    if (ruin) {
      CreepUtils.consoleLogIfWatched(this.creep, `moving to ruin: ${ruin.pos.x},${ruin.pos.y}`);
      CreepUtils.withdrawEnergyFromOrMoveTo(this.creep, ruin);
      return;
    }

    let inactiveSource = CreepUtils.findClosestEnergySource(this.creep);
    CreepUtils.consoleLogIfWatched(this.creep, `closest inactive source: ${inactiveSource}`);
    if (inactiveSource) {
      CreepUtils.consoleLogIfWatched(this.creep, `moving to inactive source: ${inactiveSource.pos.x},${inactiveSource.pos.y}`);
      this.creep.moveTo(inactiveSource, { visualizePathStyle: { stroke: '#ffaa00' } });
      return;
    }

    CreepUtils.consoleLogIfWatched(this.creep, `stumped. Just going to sit here.`);
  }
}