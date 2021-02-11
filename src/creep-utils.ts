export class CreepUtils {
  public static harvest(creep: Creep): void {
    // harvest if adjacent to tombstone or ruin
    let tombstone = CreepUtils.findClosestTombstoneWithEnergy(creep);
    if (CreepUtils.withdrawIfAdjacent(tombstone, creep) == OK) {
      return;
    }
    let ruin = CreepUtils.findClosestRuinsWithEnergy(creep);
    if (CreepUtils.withdrawIfAdjacent(ruin, creep) == OK) {
      return;
    }

    let container = CreepUtils.findClosestContainerWithEnergy(creep);
    if (container) {
      CreepUtils.consoleLogIfWatched(creep, `moving to container: ${container.pos.x},${container.pos.y}`);
      CreepUtils.withdrawEnergyFromOrMoveTo(creep, container);
      return;
    }

    let activeSource = CreepUtils.findClosestActiveEnergySource(creep);
    if (activeSource) {
      CreepUtils.consoleLogIfWatched(creep, `moving to active source: ${activeSource.pos.x},${activeSource.pos.y}`);
      CreepUtils.harvestEnergyFromOrMoveTo(creep, activeSource);
      return;
    }

    if (tombstone) {
      CreepUtils.consoleLogIfWatched(creep, `moving to tombstone: ${tombstone.pos.x},${tombstone.pos.y}`);
      CreepUtils.withdrawEnergyFromOrMoveTo(creep, tombstone);
      return;
    }

    if (ruin) {
      CreepUtils.consoleLogIfWatched(creep, `moving to ruin: ${ruin.pos.x},${ruin.pos.y}`);
      CreepUtils.withdrawEnergyFromOrMoveTo(creep, ruin);
      return;
    }

    let inactiveSource = CreepUtils.findClosestEnergySource(creep);
    CreepUtils.consoleLogIfWatched(creep, `closest inactive source: ${inactiveSource}`);
    if (inactiveSource) {
      CreepUtils.consoleLogIfWatched(creep, `moving to inactive source: ${inactiveSource.pos.x},${inactiveSource.pos.y}`);
      creep.moveTo(inactiveSource, { visualizePathStyle: { stroke: '#ffaa00' } });
      return;
    }

    CreepUtils.consoleLogIfWatched(creep, `stumped. Just going to sit here.`);
  }

  public static findClosestTombstoneWithEnergy(creep: Creep): Tombstone | null {
    return creep.pos.findClosestByPath(FIND_TOMBSTONES, { filter: (t) => t.store.getUsedCapacity() > 0 });
  }

  public static findClosestContainerWithEnergy(creep: Creep): StructureContainer | null {
    let container = creep.pos.findClosestByPath(FIND_STRUCTURES, { filter: (s) => s.structureType == STRUCTURE_CONTAINER && s.store.getUsedCapacity() > 0 });
    return container as StructureContainer;
  }

  public static findClosestRuinsWithEnergy(creep: Creep): Ruin | null {
    return creep.pos.findClosestByPath(FIND_RUINS, { filter: (r) => r.store.getUsedCapacity() > 0 });
  }

  public static findClosestActiveEnergySource(creep: Creep): Source | null {
    return creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
  }

  public static findClosestEnergySource(creep: Creep): Source | null {
    return creep.pos.findClosestByPath(FIND_SOURCES);
  }

  public static withdrawEnergyFromOrMoveTo(creep: Creep, structure: Tombstone | Ruin | StructureContainer): ScreepsReturnCode {
    let result = creep.withdraw(structure, RESOURCE_ENERGY);
    if (result == ERR_NOT_IN_RANGE) {
      return creep.moveTo(structure, { visualizePathStyle: { stroke: '#ffaa00' } });
    }
    return result;
  }

  private static withdrawIfAdjacent(structure: Tombstone | Ruin | StructureContainer | null, creep: Creep) {
    if (structure && creep.pos.isNearTo(structure)) {
      CreepUtils.consoleLogIfWatched(creep, `convenient ${structure.prototype}: ${structure.pos.x},${structure.pos.y}`);
      return creep.withdraw(structure, RESOURCE_ENERGY);
    }
    return ERR_NOT_IN_RANGE;
  }

  public static harvestEnergyFromOrMoveTo(creep: Creep, source: Source): ScreepsReturnCode {
    let result = creep.harvest(source);
    CreepUtils.consoleLogIfWatched(creep, `harvest result: ${result}`);
    if (result == ERR_NOT_IN_RANGE) {
      return creep.moveTo(source, { range: 1, visualizePathStyle: { stroke: '#ffaa00' } });
    }
    return result;
  }

  public static consoleLogIfWatched(watchable: Watchable, message: string) {
    if (watchable.memory.watched == true) {
      console.log(`${watchable.name}: ${message}`);
    }
  }

  public static getEnergyStorePercentFree(structure: StructureWithStorage): number {
    const freeCap = structure.store.getFreeCapacity(RESOURCE_ENERGY);
    const totalCap = structure.store.getCapacity(RESOURCE_ENERGY);
    if (freeCap && totalCap) {
      return freeCap / totalCap;
    }
    else {
      return 0;
    }
  }

  public static findClosestTowerWithStorage(creep: Creep): StructureTower | null {
    return creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
      filter: (structure) => {
        return structure.structureType == STRUCTURE_TOWER && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
      }
    }) as StructureTower | null;
  }

  public static findClosestEnergyStorageNotFull(creep: Creep): AnyStructure | null {
    return creep.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: (structure) => {
        return (structure.structureType == STRUCTURE_EXTENSION ||
          structure.structureType == STRUCTURE_SPAWN) &&
          structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
      }
    });
  }

  public static findConstructionSites(creep: Creep) {
    return creep.room.find(FIND_CONSTRUCTION_SITES);
  }

  public static findTowers(creep: Creep): AnyOwnedStructure[] {
    return creep.room.find(FIND_MY_STRUCTURES, { filter: (structure) => structure.structureType == STRUCTURE_TOWER });
  }

  public static findRepairSites(creep: Creep): AnyOwnedStructure[] {
    return creep.room.find(FIND_MY_STRUCTURES, { filter: (structure) => structure.hits < structure.hitsMax });
  }

  public static updateJob(creep: Creep, job: string) {
    if (creep.memory.job != job) {
      creep.memory.job = job;
      creep.say(job);
    }
  }

  public static stopWorkingIfEmpty(creep: Creep) {
    if (creep.memory.working && creep.store[RESOURCE_ENERGY] == 0) {
      creep.memory.working = false;
      creep.say('🔄 harvest');
    }
  }

  public static startWorkingIfFull(creep: Creep, message: string) {
    if (!creep.memory.working && creep.store.getFreeCapacity() == 0) {
      creep.memory.working = true;
      creep.say(message);
    }
  }
}
