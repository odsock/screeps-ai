import { CreepUtils } from "creep-utils";
import { MemoryUtils } from "planning/memory-utils";
import { RoomWrapper } from "./room-wrapper";
export class SpawnWrapper extends StructureSpawn {
  public constructor(spawn: StructureSpawn) {
    super(spawn.id);
  }

  public get roomw(): RoomWrapper {
    return RoomWrapper.getInstance(this.room.name);
  }

  public spawn({
    body,
    role,
    retiree,
    targetRoom
  }: {
    body: BodyPartConstant[];
    role: string;
    retiree?: string;
    targetRoom?: string;
  }): ScreepsReturnCode {
    const newName = `${role}_${Game.time.toString(16)}`;
    const memory: CreepMemory = { role };
    if (retiree) {
      memory.retiree = retiree;
    }
    if (targetRoom) {
      memory.targetRoom = targetRoom;
    }
    let extensions = MemoryUtils.getCache<(StructureExtension | StructureSpawn)[]>(
      `${this.room.name}_energyStructureOrder`
    );
    if (!extensions) {
      let center: RoomPosition;
      const storage = this.roomw.storage;
      if (storage) {
        center = storage.pos;
      } else {
        center = this.pos;
      }
      extensions = this.roomw
        .find<StructureExtension | StructureSpawn>(FIND_MY_STRUCTURES, {
          filter: s => s.structureType === STRUCTURE_EXTENSION || s.structureType === STRUCTURE_SPAWN
        })
        .sort((a, b) => a.pos.getRangeTo(center) - b.pos.getRangeTo(center));
      MemoryUtils.setCache(`${this.room.name}_energyStructureOrder`, extensions, 100);
    }
    const result = this.spawnCreep(body, newName, { memory, energyStructures: extensions });
    CreepUtils.consoleLogIfWatched(this, `spawning: ${role} ${CreepUtils.creepBodyToString(body)}`, result);
    if (result === ERR_INVALID_ARGS) {
      console.log(`Invalid spawn: ${role} ${CreepUtils.creepBodyToString(body)}`);
    }
    return result;
  }
}
