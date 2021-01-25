import { CreepUtils } from "creep-utils";

export class RoleWorker {
  public static run(creep: Creep): void {
    if (creep.room.energyCapacityAvailable > 0) {
      this.harvest(creep);
    }
    // else if (creep.room.find(FIND_CONSTRUCTION_SITES))
  }

  public static upgrade(creep: Creep): void {

    if (creep.memory.upgrading && creep.store[RESOURCE_ENERGY] == 0) {
        creep.memory.upgrading = false;
        creep.say('🔄 harvest');
    }
    if (!creep.memory.upgrading && creep.store.getFreeCapacity() == 0) {
        creep.memory.upgrading = true;
        creep.say('⚡ upgrade');
    }

    if (creep.memory.upgrading) {
        const controller = creep.room.controller;
        if (controller && creep.upgradeController(controller) == ERR_NOT_IN_RANGE) {
            creep.moveTo(controller, { visualizePathStyle: { stroke: '#ffffff' } });
        }
    }
    else {
        CreepUtils.harvest(creep);
    }
}

  public static build(creep: Creep): void {

		if (creep.memory.building && creep.store[RESOURCE_ENERGY] == 0) {
			creep.memory.building = false;
			creep.say('🔄 harvest');
		}
		if (!creep.memory.building && creep.store.getFreeCapacity() == 0) {
			creep.memory.building = true;
			creep.say('🚧 build');
		}

		if (creep.memory.building) {
			let targets = creep.room.find(FIND_CONSTRUCTION_SITES);
			if (targets.length) {
				creep.memory.idle = false;
				if (creep.build(targets[0]) == ERR_NOT_IN_RANGE) {
					creep.moveTo(targets[0], { visualizePathStyle: { stroke: '#ffffff' } });
				}
			}
			else {
				creep.memory.idle = true;
			}
		}
		else {
			CreepUtils.harvest(creep);
		}
	}

  public static harvest(creep: Creep): void {
    if (creep.store.getFreeCapacity() > 0) {
      CreepUtils.harvest(creep);
    }
    else {
      var targets = RoleWorker.findEnergyStorage(creep);
      if (targets.length > 0) {
        creep.memory.idle = false;
        if (creep.transfer(targets[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
          creep.moveTo(targets[0], { visualizePathStyle: { stroke: '#ffffff' } });
        }
      }
      else {
        creep.memory.idle = true;
      }
    }
  }

  private static findEnergyStorage(creep: Creep): AnyStructure[] {
    return creep.room.find(FIND_STRUCTURES, {
      filter: (structure) => {
        return (structure.structureType == STRUCTURE_EXTENSION ||
          structure.structureType == STRUCTURE_SPAWN ||
          structure.structureType == STRUCTURE_TOWER) &&
          structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
      }
    });
  }
}
