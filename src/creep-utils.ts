export class CreepUtils {
  public static harvest(creep: Creep): void {
    let container = CreepUtils.findClosestContainerWithEnergy(creep);
    if (container) {
      CreepUtils.withdrawEnergyFromOrMoveTo(creep, container);
      return;
    }
    let source = CreepUtils.findClosestEnergySource(creep);
    if (source) {
      CreepUtils.harvestEnergyFromOrMoveTo(creep, source);
    }
    let tombstone = CreepUtils.findClosestTombstoneWithEnergy(creep);
    if (tombstone) {
      CreepUtils.withdrawEnergyFromOrMoveTo(creep, tombstone);
      return;
    }
    let ruin = CreepUtils.findClosestRuinsWithEnergy(creep);
    if (ruin) {
      CreepUtils.withdrawEnergyFromOrMoveTo(creep, ruin);
      return;
    }
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

  public static findClosestEnergySource(creep: Creep): Source | null {
    return creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
  }

  public static withdrawEnergyFromOrMoveTo(creep: Creep, structure: Tombstone | Ruin | StructureContainer): ScreepsReturnCode {
    let result = creep.withdraw(structure, RESOURCE_ENERGY);
    if (result == ERR_NOT_IN_RANGE) {
      return creep.moveTo(structure, { visualizePathStyle: { stroke: '#ffaa00' } });
    }
    return result;
  }

  public static harvestEnergyFromOrMoveTo(creep: Creep, source: Source): ScreepsReturnCode {
    let result = creep.harvest(source);
    if (result == ERR_NOT_IN_RANGE) {
      return creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
    }
    return result;
  }

  public static consoleLogIfWatched(watchable: Watchable, message: string) {
    if (watchable.memory.watched == true) {
      console.log(`${watchable.name}: ${message}`);
    }
  }
}
