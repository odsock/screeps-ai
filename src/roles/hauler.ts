import { CreepUtils } from "creep-utils";

export class Hauler {
  constructor(private readonly creep: Creep) { }

  private readonly TOWER_SUPPLY_THRESHOLD = .5;

  public run() {
    // supply spawn/extensions if any capacity in room
    if (this.creep.room.energyAvailable < this.creep.room.energyCapacityAvailable) {
      CreepUtils.consoleLogIfWatched(this.creep, 'supply spawn job');
      this.supplySpawn();
      return;
    }

    // supply tower if half empty
    const tower = CreepUtils.findClosestTowerWithStorage(this.creep);
    if (tower) {
      const towerPercentFree = CreepUtils.getEnergyStorePercentFree(tower);
      CreepUtils.consoleLogIfWatched(this.creep, `towerPercentFree: ${towerPercentFree}`);
      if (this.creep.memory.job == 'tower' || towerPercentFree > this.TOWER_SUPPLY_THRESHOLD) {
        CreepUtils.consoleLogIfWatched(this.creep, 'supply tower job');
        this.supplyTower();
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
          this.creep.moveTo(controllerContainer, { range: 1, visualizePathStyle: { stroke: '#ffffff' } });
        }
      }
      else {
        if (this.creep.withdraw(sourceContainer, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
          this.creep.moveTo(sourceContainer, { range: 1, visualizePathStyle: { stroke: '#ffffff' } });
        }
      }
    }
  }

  private supplySpawn(): void {
    CreepUtils.consoleLogIfWatched(this.creep, `supply spawn`);
    CreepUtils.updateJob(this.creep, 'spawn');
    CreepUtils.stopWorkingIfEmpty(this.creep);
    CreepUtils.startWorkingIfFull(this.creep, '⚡ spawn');
    this.workOrHarvest(this.creep, () => {
      const site = CreepUtils.findClosestEnergyStorageNotFull(this.creep);
      if (site) {
        if (this.creep.transfer(site, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
          CreepUtils.consoleLogIfWatched(this.creep, `site out of range: ${site.pos.x},${site.pos.y}`);
          this.creep.moveTo(site, { range: 1, visualizePathStyle: { stroke: '#ffffff' } });
        }
      }
    });
  }

  private supplyTower(): void {
    CreepUtils.consoleLogIfWatched(this.creep, `supply tower`);
    CreepUtils.updateJob(this.creep, 'tower');
    CreepUtils.stopWorkingIfEmpty(this.creep);
    CreepUtils.startWorkingIfFull(this.creep, '⚡ tower');
    this.workOrHarvest(this.creep, () => {
      const site = CreepUtils.findClosestTowerWithStorage(this.creep);
      if (site) {
        if (this.creep.transfer(site, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
          CreepUtils.consoleLogIfWatched(this.creep, `site out of range: ${site.pos.x},${site.pos.y}`);
          this.creep.moveTo(site, { range: 1, visualizePathStyle: { stroke: '#ffffff' } });
        }
      }
      else {
        this.creep.memory.job = '';
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

  private findClosestSourceContainer(): StructureContainer | null {
    const sources = this.creep.room.find(FIND_SOURCES);
    let containers: StructureContainer[] = [];
    if (sources.length > 0) {
      for (let i = 0; i < sources.length; i++) {
        const container = sources[i].pos.findInRange(FIND_STRUCTURES, 1, {
          filter: (s) => s.structureType == STRUCTURE_CONTAINER
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

    const container = CreepUtils.findClosestContainerWithEnergy(this.creep);
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

    const closestSourceContainer = this.findClosestSourceContainer();
    if (closestSourceContainer) {
      CreepUtils.consoleLogIfWatched(this.creep, `moving to source container: ${closestSourceContainer.pos.x},${closestSourceContainer.pos.y}`);
      this.creep.moveTo(closestSourceContainer, { range: 1, visualizePathStyle: { stroke: '#ffaa00' } });
      return;
    }

    this.creep.say('🤔');
    CreepUtils.consoleLogIfWatched(this.creep, `stumped. Just going to sit here.`);
  }
}