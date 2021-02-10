import { CreepUtils } from "creep-utils";

export class Hauler {
  constructor(private readonly creep: Creep) { }

  public run() {
    // harvest if any capacity in room
    if (this.creep.room.energyAvailable < this.creep.room.energyCapacityAvailable) {
      CreepUtils.consoleLogIfWatched(this.creep, 'harvesting job');
      this.harvest(this.creep);
      return;
    }

    // supply tower if half empty
    const tower = CreepUtils.findClosestTowerWithStorage(this.creep);
    if (tower) {
      const towerPercentFree = CreepUtils.getEnergyStorePercentFree(tower);
      CreepUtils.consoleLogIfWatched(this.creep, `towerPercentFree: ${towerPercentFree}`);
      if (this.creep.memory.job == 'supply' || towerPercentFree > .5) {
        CreepUtils.consoleLogIfWatched(this.creep, 'supply job');
        this.supply(this.creep);
        return;
      }
    }
  }

  private harvest(creep: Creep): void {
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

  private supply(creep: Creep): void {
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

  private workOrHarvest(creep: Creep, work: Function) {
    if (creep.memory.working) {
      work();
    }
    else {
      CreepUtils.harvest(creep);
    }
  }

  private findControllerContainers(): StructureContainer[] | null {
    let containers: StructureContainer[] = [];
    if (this.creep.room.controller) {
      containers = this.creep.room.controller.pos.findInRange(FIND_STRUCTURES, 3, { filter: (s) => s.structureType == STRUCTURE_CONTAINER }) as StructureContainer[];
    }
    return containers;
  }

  private findSourceContainers(): StructureContainer[] {
    const sources = this.creep.room.find(FIND_SOURCES);
    let containers: StructureContainer[] = [];
    if (sources.length > 0) {
      for (let i = 0; i < sources.length; i++) {
        const container = sources[i].pos.findInRange(FIND_STRUCTURES, 1, { filter: (s) => s.structureType == STRUCTURE_CONTAINER });
        if (container.length > 0) {
          containers.push(container[0] as StructureContainer);
        }
      }
    }
    return containers;
  }
}