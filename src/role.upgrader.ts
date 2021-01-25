import { CreepUtils } from "creep-utils";

export class RoleUpgrader {
    public static run(creep: Creep): void {

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
}
