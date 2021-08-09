import { CreepUtils } from "creep-utils";
import { MemoryUtils } from "planning/memory-utils";
import { Constants } from "../constants";
import { CreepWrapper } from "./creep-wrapper";

// TODO: assign to source containers or something so they don't only use closest
// TODO: get hauler to pull harvester to container
export class Hauler extends CreepWrapper {
  // debugging
  private stackDepth = 0;

  public run(): void {
    this.touchRoad();

    // claim container if free
    if (!this.getMyContainer()) {
      const claimSourceResult = this.claimSourceContainer();
      CreepUtils.consoleLogIfWatched(this, `claim source container result: ${claimSourceResult}`);
      if (claimSourceResult !== OK) {
        CreepUtils.consoleLogIfWatched(this, `no free containers`);
      }
    }

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
    this.stackDepth = 0;
    this.supplyController();
  }

  // TODO don't pull/drop from the same container like a bozo
  private supplyController(): ScreepsReturnCode {
    this.stackDepth += 1;
    console.log(this.stackDepth);
    let result: ScreepsReturnCode = ERR_NOT_FOUND;
    const controllerContainer = this.findClosestControllerContainerNotFull();
    if (controllerContainer) {
      this.updateJob("upgrade");
      this.stopWorkingIfEmpty();
      this.startWorkingIfFull("⚡ upgrade");
      // TODO make close work site check work here, maybe only go for refill if can fill?

      if (this.memory.working) {
        CreepUtils.consoleLogIfWatched(this, "working");
        result = this.transfer(controllerContainer, RESOURCE_ENERGY);
        if (result === ERR_NOT_IN_RANGE) {
          result = this.moveTo(controllerContainer, { range: 1, visualizePathStyle: { stroke: "#ffffff" } });
          CreepUtils.consoleLogResultIfWatched(this, `moving to controller`, result);
        }
      } else {
        result = this.loadEnergy();
        if (result === ERR_NOT_FOUND) {
          // nowhere to get energy - start working if not empty
          if (this.store.energy > 0) {
            this.memory.working = true;
            CreepUtils.consoleLogIfWatched(this, "no energy to load, start working");
            result = this.supplyController();
          }
        }
      }
    } else {
      CreepUtils.consoleLogIfWatched(this, "no controller containers need supply");
    }
    return result;
  }

  private supplySpawn(): ScreepsReturnCode {
    let result: ScreepsReturnCode = ERR_NOT_FOUND;
    const site = this.findClosestEnergyStorageNotFull();
    if (site) {
      CreepUtils.consoleLogIfWatched(this, `supply spawn`);
      this.updateJob("spawn");
      this.stopWorkingIfEmpty();
      this.startWorkingIfFull("⚡ spawn");
      this.workIfCloseToJobsite(site.pos, 1);

      if (this.memory.working) {
        result = this.transfer(site, RESOURCE_ENERGY);
        if (result === ERR_NOT_IN_RANGE) {
          CreepUtils.consoleLogIfWatched(this, `site out of range: ${site.pos.x},${site.pos.y}`);
          result = this.moveTo(site, { range: 1, visualizePathStyle: { stroke: "#ffffff" } });
        }
      } else {
        result = this.loadEnergy();
        if (result === ERR_NOT_FOUND) {
          // nowhere to get energy - start working if not empty
          if (this.store.energy > 0) {
            this.memory.working = true;
            CreepUtils.consoleLogIfWatched(this, "no energy to load, start working");
            result = this.supplyController();
          }
        }
      }
    }
    return result;
  }

  // TODO: stop supply when tower is full
  // have to calc check at end of tick, or will never be full (tower shoots first)
  // can't rely on getFreeCapacity because it won't update after transfer
  private supplyTower(): ScreepsReturnCode {
    let result: ScreepsReturnCode = ERR_NOT_FOUND;
    const tower = this.findClosestTowerNotFull();
    if (tower) {
      CreepUtils.consoleLogIfWatched(this, `supply tower`);
      this.updateJob("tower");
      this.stopWorkingIfEmpty();
      this.startWorkingIfFull("⚡ tower");
      this.workIfCloseToJobsite(tower.pos, 1);

      if (this.memory.working) {
        let creepStoredEnergy = this.store.getUsedCapacity(RESOURCE_ENERGY);
        result = this.transfer(tower, RESOURCE_ENERGY);
        if (result === ERR_NOT_IN_RANGE) {
          CreepUtils.consoleLogIfWatched(this, `tower out of range: ${tower.pos.x},${tower.pos.y}`);
          result = this.moveTo(tower, { range: 1, visualizePathStyle: { stroke: "#ffffff" } });
        } else {
          // Stop if tower is full now
          const towerFreeCap = tower.store.getFreeCapacity(RESOURCE_ENERGY);
          creepStoredEnergy = this.store.getUsedCapacity(RESOURCE_ENERGY);
          if (result === OK && towerFreeCap < creepStoredEnergy) {
            CreepUtils.consoleLogIfWatched(this, `tower is full: ${tower.pos.x},${tower.pos.y}`);
            this.updateJob("idle");
          }
        }
      } else {
        result = this.loadEnergy();
        if (result === ERR_NOT_FOUND) {
          // nowhere to get energy - start working if not empty
          if (this.store.energy > 0) {
            this.memory.working = true;
            CreepUtils.consoleLogIfWatched(this, "no energy to load, start working");
            result = this.supplyController();
          }
        }
      }
    } else {
      this.updateJob("idle");
    }
    return result;
  }

  private findClosestControllerContainerNotFull(): StructureContainer | null {
    const containersNotFull = this.roomw.controllerContainers.filter(
      container => container.store.getFreeCapacity() > 0
    );
    CreepUtils.consoleLogIfWatched(this, `controller containers not full: ${containersNotFull.length}`);
    return this.pos.findClosestByPath(containersNotFull);
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
      return CreepUtils.getEnergyStoreRatioFree(tower) > Constants.TOWER_RESUPPLY_THRESHOLD;
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

  private pickupAdjacentDroppedEnergy(): ScreepsReturnCode {
    let pickupResult: ScreepsReturnCode = ERR_NOT_FOUND;
    const resources = this.pos.findInRange(FIND_DROPPED_RESOURCES, 1, {
      filter: r => r.resourceType === RESOURCE_ENERGY
    });
    if (resources.length > 0) {
      pickupResult = this.pickup(resources[0]);
    }
    return pickupResult;
  }

  private loadEnergy(): ScreepsReturnCode {
    this.pickupAdjacentDroppedEnergy();
    this.withdrawAdjacentRuinOrTombEnergy();
    // TODO: calc current free capacity here, might should quit loading or move adjacent load calls

    const tombstone = this.findClosestTombstoneWithEnergy();
    const ruin = this.findClosestRuinsWithEnergy();
    const droppedEnergy = this.findClosestDroppedEnergy();

    const container = this.findClosestSourceContainerNotEmpty();
    if (container) {
      CreepUtils.consoleLogIfWatched(this, `moving to container: ${container.pos.x},${container.pos.y}`);
      return this.withdrawEnergyFromOrMoveTo(container);
    }

    if (tombstone) {
      CreepUtils.consoleLogIfWatched(this, `moving to tombstone: ${tombstone.pos.x},${tombstone.pos.y}`);
      return this.withdrawEnergyFromOrMoveTo(tombstone);
    }

    if (ruin) {
      CreepUtils.consoleLogIfWatched(this, `moving to ruin: ${ruin.pos.x},${ruin.pos.y}`);
      return this.withdrawEnergyFromOrMoveTo(ruin);
    }

    if (droppedEnergy) {
      CreepUtils.consoleLogIfWatched(this, `moving to ruin: ${droppedEnergy.pos.x},${droppedEnergy.pos.y}`);
      return this.pickupFromOrMoveTo(droppedEnergy);
    }

    this.say("🤔");
    CreepUtils.consoleLogIfWatched(this, `stumped. Just going to sit here.`);
    return ERR_NOT_FOUND;
  }

  protected claimSourceContainer(): ScreepsReturnCode {
    MemoryUtils.refreshContainerMemory(this.room);
    const containerInfos = this.room.memory.containers.filter(info => info.nearSource && info.haulers.length === 0);
    if (containerInfos.length > 0) {
      const containerInfo = containerInfos[0];
      containerInfo.haulers.push(this.id);
      CreepUtils.consoleLogIfWatched(this, `claimed source container: ${containerInfo.containerId}`);
      this.memory.containerId = containerInfo.containerId as Id<StructureContainer>;
      return OK;
    }
    return ERR_NOT_FOUND;
  }
}
