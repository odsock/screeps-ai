import config from "../constants";
import { CreepUtils } from "creep-utils";

// TODO: get hauler to pull havester to container
export class Hauler {
  constructor(private readonly creep: Creep) { }

  public run() {
    // supply spawn/extensions if any capacity in room
    if (this.creep.room.energyAvailable < this.creep.room.energyCapacityAvailable) {
      this.supplySpawn();
      return;
    }

    // fill closest tower if any fall below threshold
    if (this.creep.memory.job == 'tower' || this.findTowersBelowThreshold().length > 0) {
      this.supplyTower();
      return;
    }

    // otherwise supply controller
    this.supplyController();
  }

  private supplyController() {
    const controllerContainer = this.findClosestControllerContainerNotFull();
    const sourceContainer = this.findClosestSourceContainerNotEmpty();
    if (controllerContainer && sourceContainer) {
      CreepUtils.updateJob(this.creep, 'upgrade');
      CreepUtils.stopWorkingIfEmpty(this.creep);
      CreepUtils.startWorkingIfFull(this.creep, '⚡ upgrade');
      CreepUtils.workIfCloseToJobsite(this.creep, controllerContainer.pos, 1);

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
    const site = CreepUtils.findClosestEnergyStorageNotFull(this.creep);
    if (site) {
      CreepUtils.consoleLogIfWatched(this.creep, `supply spawn`);
      CreepUtils.updateJob(this.creep, 'spawn');
      CreepUtils.stopWorkingIfEmpty(this.creep);
      CreepUtils.startWorkingIfFull(this.creep, '⚡ spawn');
      CreepUtils.workIfCloseToJobsite(this.creep, site.pos, 1);

      if (this.creep.memory.working) {
        if (this.creep.transfer(site, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
          CreepUtils.consoleLogIfWatched(this.creep, `site out of range: ${site.pos.x},${site.pos.y}`);
          this.creep.moveTo(site, { range: 1, visualizePathStyle: { stroke: '#ffffff' } });
        }
      }
      else {
        this.loadEnergy();
      }
    }
  }

  // TODO: stop supply when tower is full
  // have to calc check at end of tick, or will never be full (tower shoots first)
  // can't rely on getFreeCapacity because it won't update after transfer
  private supplyTower(): void {
    const tower = CreepUtils.findClosestTowerNotFull(this.creep);
    if (tower) {
      CreepUtils.consoleLogIfWatched(this.creep, `supply tower`);
      CreepUtils.updateJob(this.creep, 'tower');
      CreepUtils.stopWorkingIfEmpty(this.creep);
      CreepUtils.startWorkingIfFull(this.creep, '⚡ tower');
      CreepUtils.workIfCloseToJobsite(this.creep, tower.pos, 1);

      if (this.creep.memory.working) {
        let creepStoredEnergy = this.creep.store.getUsedCapacity(RESOURCE_ENERGY);
        console.log(creepStoredEnergy);
        const result = this.creep.transfer(tower, RESOURCE_ENERGY);
        if (result == ERR_NOT_IN_RANGE) {
          CreepUtils.consoleLogIfWatched(this.creep, `tower out of range: ${tower.pos.x},${tower.pos.y}`);
          this.creep.moveTo(tower, { range: 1, visualizePathStyle: { stroke: '#ffffff' } });
        }

        // Stop if tower is full now
        const towerFreeCap = tower.store.getFreeCapacity(RESOURCE_ENERGY);
        creepStoredEnergy = this.creep.store.getUsedCapacity(RESOURCE_ENERGY);
        console.log(creepStoredEnergy);
        if (result == OK &&  towerFreeCap < creepStoredEnergy) {
          CreepUtils.consoleLogIfWatched(this.creep, `tower is full: ${tower.pos.x},${tower.pos.y}`);
          CreepUtils.updateJob(this.creep, 'idle');
        }
      }
      else {
        this.loadEnergy();
      }
    }
    else {
      CreepUtils.updateJob(this.creep, 'idle');
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

  private findTowersBelowThreshold(): StructureTower[] {
    const towers = CreepUtils.findTowers(this.creep) as StructureTower[];
    CreepUtils.consoleLogIfWatched(this.creep, `towers: ${towers.length}`);

    const towersNotFull = towers.filter((tower) => {
      return tower.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
    });
    CreepUtils.consoleLogIfWatched(this.creep, `towers not full: ${towers.length}`);

    const towersBelowThreshold = towersNotFull.filter((tower) => {
      return CreepUtils.getEnergyStoreRatioFree(tower) > config.TOWER_RESUPPLY_THRESHOLD;
    });
    CreepUtils.consoleLogIfWatched(this.creep, `towers below threshold: ${towersBelowThreshold.length}`);

    return towersBelowThreshold;
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
    const droppedEnergy = CreepUtils.findClosestDroppedEnergy(this.creep);
    if (droppedEnergy) {
      if (this.creep.pickup(droppedEnergy) == OK) {
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

    if (droppedEnergy) {
      CreepUtils.consoleLogIfWatched(this.creep, `moving to ruin: ${droppedEnergy.pos.x},${droppedEnergy.pos.y}`);
      CreepUtils.pickupFromOrMoveTo(this.creep, droppedEnergy);
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