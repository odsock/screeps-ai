import { result } from "lodash";

export class CreepUtils {
  public static harvest(creep: Creep): void {
    let result = CreepUtils.harvestFromTombstones(creep);
    console.log(result);
    if (result != 0) {
      let result = CreepUtils.harvestFromRuins(creep);
      console.log(result);
      if (result != 0) {
        let result = CreepUtils.harvestFromContainer(creep);
        console.log(result);
        if (result != 0) {
          let result = CreepUtils.harvestFromSource(creep);
          console.log(result);
        }
      }
    }
  }

  private static harvestFromContainer(creep: Creep): ScreepsReturnCode {
    let containersWithEnergy = creep.room.find(FIND_STRUCTURES, { filter: (s) => s.structureType == STRUCTURE_CONTAINER && s.store.getUsedCapacity() > 0 });
    if (containersWithEnergy.length) {
      let result = creep.withdraw(containersWithEnergy[0], RESOURCE_ENERGY);
      if (result == ERR_NOT_IN_RANGE) {
        return creep.moveTo(containersWithEnergy[0], { visualizePathStyle: { stroke: '#ffaa00' } });
      }
      return result;
    }
    return ERR_NOT_FOUND;
  }

  private static harvestFromRuins(creep: Creep) {
    let ruinsWithEnergy = creep.room.find(FIND_RUINS, { filter: (r) => r.store.getUsedCapacity() > 0 });
    if (ruinsWithEnergy.length) {
      let result = creep.withdraw(ruinsWithEnergy[0], RESOURCE_ENERGY);
      if (result == ERR_NOT_IN_RANGE) {
        return creep.moveTo(ruinsWithEnergy[0], { visualizePathStyle: { stroke: '#ffaa00' } });
      }
      return result;
    }
    return ERR_NOT_FOUND;
  }

  private static harvestFromSource(creep: Creep) {
    let sources = creep.room.find(FIND_SOURCES);
    if (sources.length) {
      let result = creep.harvest(sources[0]);
      if (result == ERR_NOT_IN_RANGE) {
        return creep.moveTo(sources[0], { visualizePathStyle: { stroke: '#ffaa00' } });
      }
      return result;
    }
    return ERR_NOT_FOUND;
  }

  private static harvestFromTombstones(creep: Creep) {
    let tombstonesWithEnergy = creep.room.find(FIND_TOMBSTONES, { filter: (t) => t.store.getUsedCapacity() > 0 });
    if (tombstonesWithEnergy.length) {
      let result = creep.withdraw(tombstonesWithEnergy[0], RESOURCE_ENERGY);
      if (result == ERR_NOT_IN_RANGE) {
        return creep.moveTo(tombstonesWithEnergy[0], { visualizePathStyle: { stroke: '#ffaa00' } });
      }
      return result;
    }
    return ERR_NOT_FOUND;
  }
}
