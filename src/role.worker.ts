import { CreepUtils } from "creep-utils";

export class RoleWorker {
  public static run(creep: Creep): void {
    console.log(`energy capacity: ${creep.room.energyAvailable}/${creep.room.energyCapacityAvailable}`);
    if (creep.room.energyAvailable < creep.room.energyCapacityAvailable) {
      console.log('harvesting');
      this.harvest(creep);
    }
    else if (creep.room.find(FIND_CONSTRUCTION_SITES).length > 0) {
      this.build(creep);
    }
    else {
      this.upgrade(creep);
    }
  }

  // TODO: harvest if not full and closer to the energy source than the controller
  private static upgrade(creep: Creep): void {
    if(creep.memory.job != 'upgrading') {
      creep.memory.job = 'upgrading';
      creep.say('upgrader');
    }

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

  private static build(creep: Creep): void {
    if(creep.memory.job != 'building') {
      creep.memory.job = 'building';
      creep.say('builder');
    }

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
        if (creep.build(targets[0]) == ERR_NOT_IN_RANGE) {
          creep.moveTo(targets[0], { visualizePathStyle: { stroke: '#ffffff' } });
        }
      }
    }
    else {
      CreepUtils.harvest(creep);
    }
  }

  // TODO: transfer if not empty, but harvest until full (need flag probably)
  private static harvest(creep: Creep): void {
    if(creep.memory.job != 'harvester') {
      creep.memory.job = 'harvester';
      creep.say('harvester');
    }
    let freeCapacity = creep.store.getFreeCapacity();
    console.log(`free cap: ${freeCapacity}`);
    if (freeCapacity > 0) {
      console.log('creep empty');
      CreepUtils.harvest(creep);
    }
    else {
      console.log('searching');
      var targets = RoleWorker.findEnergyStorage(creep);
      if (targets.length > 0) {
        if (creep.transfer(targets[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
          creep.moveTo(targets[0], { visualizePathStyle: { stroke: '#ffffff' } });
        }
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
