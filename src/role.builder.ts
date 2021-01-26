import { CreepUtils } from "creep-utils";

export class RoleBuilder {
  public static run(creep: Creep): void {

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
        // get creep out of the way if idle
        creep.moveTo(Game.spawns['Spawn1'], { visualizePathStyle: { stroke: '#ff0000' } });
      }
    }
    else {
      CreepUtils.harvest(creep);
    }
  }
}
