import { CreepUtils } from "creep-utils";
import { CreepWrapper } from "./creep-wrapper";
import config from "../constants";

// TODO: assign to source containers or something so they don't only use closest
// TODO: get hauler to pull havester to container
export class Hauler extends CreepWrapper {
  public run(): void {
    super.run();

    // supply spawn/extensions if any capacity in room
    if (this.room.energyAvailable < this.room.energyCapacityAvailable) {
      this.supplySpawn();
      return;
    }

    // fill closest tower if any fall below threshold
    if (this.memory.job === "tower" || this.findTowersBelowThreshold().length > 0) {
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
      this.updateJob("upgrade");
      this.stopWorkingIfEmpty();
      this.startWorkingIfFull("⚡ upgrade");
      this.workIfCloseToJobsite(controllerContainer.pos, 1);
      // TODO: if source is empty, start hauling even if not full

      if (this.memory.working) {
        CreepUtils.consoleLogIfWatched(this, "working");
        if (this.transfer(controllerContainer, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
          const result = this.moveTo(controllerContainer, { range: 1, visualizePathStyle: { stroke: "#ffffff" } });
          CreepUtils.consoleLogIfWatched(this, `moving to controller: ${result}`);
        }
      } else {
        // TODO: pickup energy from convenient sources other than source (but not controller)
        CreepUtils.consoleLogIfWatched(this, "not working");
        if (this.withdraw(sourceContainer, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
          const result = this.moveTo(sourceContainer, { range: 1, visualizePathStyle: { stroke: "#ffffff" } });
          CreepUtils.consoleLogIfWatched(this, `moving to source: ${result}`);
        }
      }
    }
  }

  private supplySpawn(): void {
    const site = this.findClosestEnergyStorageNotFull();
    if (site) {
      CreepUtils.consoleLogIfWatched(this, `supply spawn`);
      this.updateJob("spawn");
      this.stopWorkingIfEmpty();
      this.startWorkingIfFull("⚡ spawn");
      this.workIfCloseToJobsite(site.pos, 1);

      if (this.memory.working) {
        if (this.transfer(site, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
          CreepUtils.consoleLogIfWatched(this, `site out of range: ${site.pos.x},${site.pos.y}`);
          this.moveTo(site, { range: 1, visualizePathStyle: { stroke: "#ffffff" } });
        }
      } else {
        this.loadEnergy();
      }
    }
  }

  // TODO: stop supply when tower is full
  // have to calc check at end of tick, or will never be full (tower shoots first)
  // can't rely on getFreeCapacity because it won't update after transfer
  private supplyTower(): void {
    const tower = this.findClosestTowerNotFull();
    if (tower) {
      CreepUtils.consoleLogIfWatched(this, `supply tower`);
      this.updateJob("tower");
      this.stopWorkingIfEmpty();
      this.startWorkingIfFull("⚡ tower");
      this.workIfCloseToJobsite(tower.pos, 1);

      if (this.memory.working) {
        let creepStoredEnergy = this.store.getUsedCapacity(RESOURCE_ENERGY);
        const result = this.transfer(tower, RESOURCE_ENERGY);
        if (result === ERR_NOT_IN_RANGE) {
          CreepUtils.consoleLogIfWatched(this, `tower out of range: ${tower.pos.x},${tower.pos.y}`);
          this.moveTo(tower, { range: 1, visualizePathStyle: { stroke: "#ffffff" } });
        }

        // Stop if tower is full now
        const towerFreeCap = tower.store.getFreeCapacity(RESOURCE_ENERGY);
        creepStoredEnergy = this.store.getUsedCapacity(RESOURCE_ENERGY);
        if (result === OK && towerFreeCap < creepStoredEnergy) {
          CreepUtils.consoleLogIfWatched(this, `tower is full: ${tower.pos.x},${tower.pos.y}`);
          this.updateJob("idle");
        }
      } else {
        this.loadEnergy();
      }
    } else {
      this.updateJob("idle");
    }
  }

  private findClosestControllerContainerNotFull(): StructureContainer | null {
    let containers: StructureContainer[] = [];
    if (this.room.controller) {
      containers = this.room.controller.pos.findInRange(FIND_STRUCTURES, 3, {
        filter: s => s.structureType === STRUCTURE_CONTAINER && s.store.getFreeCapacity() > 0
      }) as StructureContainer[];
    }
    return this.pos.findClosestByPath(containers);
  }

  private findClosestSourceContainerNotEmpty(): StructureContainer | null {
    const sources = this.room.find(FIND_SOURCES);
    const containers: StructureContainer[] = [];
    if (sources.length > 0) {
      for (const source of sources) {
        const container = source.pos.findInRange(FIND_STRUCTURES, 1, {
          filter: s => s.structureType === STRUCTURE_CONTAINER && s.store.getUsedCapacity() > 0
        });
        if (container.length > 0) {
          containers.push(container[0] as StructureContainer);
        }
      }
    }
    return this.pos.findClosestByPath(containers);
  }

  private findClosestSourceContainer(): StructureContainer | null {
    const sources = this.room.find(FIND_SOURCES);
    const containers: StructureContainer[] = [];
    if (sources.length > 0) {
      for (const source of sources) {
        const container = source.pos.findInRange(FIND_STRUCTURES, 1, {
          filter: s => s.structureType === STRUCTURE_CONTAINER
        });
        if (container.length > 0) {
          containers.push(container[0] as StructureContainer);
        }
      }
    }
    return this.pos.findClosestByPath(containers);
  }

  private findTowersBelowThreshold(): StructureTower[] {
    const towers = this.roomw.towers;
    CreepUtils.consoleLogIfWatched(this, `towers: ${towers.length}`);

    const towersNotFull = towers.filter(tower => {
      return tower.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
    });
    CreepUtils.consoleLogIfWatched(this, `towers not full: ${towers.length}`);

    const towersBelowThreshold = towersNotFull.filter(tower => {
      return CreepUtils.getEnergyStoreRatioFree(tower) > config.TOWER_RESUPPLY_THRESHOLD;
    });
    CreepUtils.consoleLogIfWatched(this, `towers below threshold: ${towersBelowThreshold.length}`);

    return towersBelowThreshold;
  }

  private withdrawAdjacentRuinOrTombEnergy(): ScreepsReturnCode {
    // can't withdraw twice, so prefer emptying tombstones because they decay faster
    let withdrawResult: ScreepsReturnCode = ERR_NOT_FOUND;
    const tombs = this.pos.findInRange(FIND_TOMBSTONES, 1, {
      filter: t => t.store.getUsedCapacity(RESOURCE_ENERGY) > 0
    });
    if (tombs.length > 0) {
      withdrawResult = this.withdraw(tombs[0], RESOURCE_ENERGY);
    } else {
      const ruins = this.pos.findInRange(FIND_RUINS, 1, { filter: r => r.store.getUsedCapacity(RESOURCE_ENERGY) > 0 });
      if (ruins.length > 0) {
        withdrawResult = this.withdraw(ruins[0], RESOURCE_ENERGY);
      }
    }
    return withdrawResult;
  }

  private pickupAdjacentDroppedEnergy() {
    let pickupResult: ScreepsReturnCode = ERR_NOT_FOUND;
    const resources = this.pos.findInRange(FIND_DROPPED_RESOURCES, 1, {
      filter: r => r.resourceType === RESOURCE_ENERGY
    });
    if (resources.length > 0) {
      pickupResult = this.pickup(resources[0]);
    }
    return pickupResult;
  }

  private loadEnergy(): void {
    this.pickupAdjacentDroppedEnergy();
    this.withdrawAdjacentRuinOrTombEnergy();
    // TODO: calc current free capacity here, might should quit loading or move adjacent load calls

    const tombstone = this.findClosestTombstoneWithEnergy();
    const ruin = this.findClosestRuinsWithEnergy();
    const droppedEnergy = this.findClosestDroppedEnergy();

    const container = this.findClosestContainerWithEnergy();
    if (container) {
      CreepUtils.consoleLogIfWatched(this, `moving to container: ${container.pos.x},${container.pos.y}`);
      this.withdrawEnergyFromOrMoveTo(container);
      return;
    }

    if (tombstone) {
      CreepUtils.consoleLogIfWatched(this, `moving to tombstone: ${tombstone.pos.x},${tombstone.pos.y}`);
      this.withdrawEnergyFromOrMoveTo(tombstone);
      return;
    }

    if (ruin) {
      CreepUtils.consoleLogIfWatched(this, `moving to ruin: ${ruin.pos.x},${ruin.pos.y}`);
      this.withdrawEnergyFromOrMoveTo(ruin);
      return;
    }

    if (droppedEnergy) {
      CreepUtils.consoleLogIfWatched(this, `moving to ruin: ${droppedEnergy.pos.x},${droppedEnergy.pos.y}`);
      this.pickupFromOrMoveTo(droppedEnergy);
      return;
    }

    const closestSourceContainer = this.findClosestSourceContainer();
    if (closestSourceContainer) {
      CreepUtils.consoleLogIfWatched(
        this,
        `moving to source container: ${closestSourceContainer.pos.x},${closestSourceContainer.pos.y}`
      );
      this.moveTo(closestSourceContainer, { range: 1, visualizePathStyle: { stroke: "#ffaa00" } });
      return;
    }

    this.say("🤔");
    CreepUtils.consoleLogIfWatched(this, `stumped. Just going to sit here.`);
  }
}
