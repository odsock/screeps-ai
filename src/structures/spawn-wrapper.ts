import { SpawnUtils } from "control/spawn-utils";
import { CreepUtils } from "creep-utils";
import { MemoryUtils } from "planning/memory-utils";
import { CreepBodyProfile } from "roles/creep-wrapper";
import { profile } from "../../screeps-typescript-profiler";
import { RoomWrapper } from "./room-wrapper";

@profile
export class SpawnWrapper extends StructureSpawn {
  public constructor(spawn: StructureSpawn) {
    super(spawn.id);
  }

  public get roomw(): RoomWrapper {
    return RoomWrapper.getInstance(this.room.name);
  }

  public spawn({
    bodyProfile,
    max,
    role,
    replacing,
    targetRoom = this.roomw.name,
    homeRoom = this.roomw.name
  }: {
    bodyProfile: CreepBodyProfile;
    max?: boolean;
    role: string;
    replacing?: string;
    targetRoom?: string;
    homeRoom?: string;
  }): ScreepsReturnCode {
    const body: BodyPartConstant[] = this.getBodyFromProfile(max, bodyProfile);
    const name = `${role}_${Game.time.toString(36)}`;
    const memory: CreepMemory = { role, targetRoom, homeRoom };
    if (replacing) {
      memory.replacing = replacing;
    }

    const extensions = this.getOrderedExtensionList();
    const result = this.spawnCreep(body, name, { memory, energyStructures: extensions });
    CreepUtils.consoleLogIfWatched(this, `spawning: ${role} ${CreepUtils.creepBodyToString(body)}`, result);
    if (result === ERR_INVALID_ARGS) {
      console.log(`Invalid spawn: ${role} ${CreepUtils.creepBodyToString(body)}`);
    } else if (result === OK && replacing) {
      Game.creeps[replacing].memory.retiring = true;
      Memory.spawns[this.name].spawning = { name, body, memory };
    }
    return result;
  }

  private getOrderedExtensionList(): (StructureSpawn | StructureExtension)[] {
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
    return extensions;
  }

  private getBodyFromProfile(max: boolean | undefined, bodyProfile: CreepBodyProfile): BodyPartConstant[] {
    let body: BodyPartConstant[];
    if (max) {
      body = SpawnUtils.getMaxBody(bodyProfile, this.roomw);
    } else {
      body = SpawnUtils.getMaxBodyNow(bodyProfile, this);
    }
    return body;
  }
}
