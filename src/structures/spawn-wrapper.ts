import { SpawnUtils } from "control/spawn-utils";
import { CreepUtils } from "creep-utils";
import { MemoryUtils } from "planning/memory-utils";
import { CreepBodyProfile } from "roles/creep-wrapper";
import { profile } from "../../screeps-typescript-profiler";
import { RoomWrapper } from "./room-wrapper";

export interface SpawnRequest {
  priority: number;
  bodyProfile: CreepBodyProfile;
  max?: boolean;
  memory: CreepMemory;
  sort?: boolean;
}

interface BodyPartPriorityLookupType {
  [part: string]: number;
}

@profile
export class SpawnWrapper extends StructureSpawn {
  private static readonly BODY_PART_ORDER = [TOUGH, CARRY, WORK, MOVE, CLAIM, RANGED_ATTACK, ATTACK, HEAL];
  private static readonly BODY_PART_ORDER_LOOKUP: BodyPartPriorityLookupType =
    SpawnWrapper.BODY_PART_ORDER.reduce<BodyPartPriorityLookupType>((lookup, part, index) => {
      lookup[part] = index;
      return lookup;
    }, {});

  public constructor(spawn: StructureSpawn) {
    super(spawn.id);
  }

  public get roomw(): RoomWrapper {
    return RoomWrapper.getInstance(this.room.name);
  }

  public spawn(request: SpawnRequest): ScreepsReturnCode {
    const memory: CreepMemory = {
      ...{
        targetRoom: this.roomw.name,
        homeRoom: this.roomw.name
      },
      ...request.memory
    };
    let body: BodyPartConstant[] = this.getBodyFromProfile(request.max, request.bodyProfile);
    if (request.sort) {
      body = this.sortBody(body);
    }
    const name = `${memory.role}_${Game.time.toString(36)}`;

    const extensions = this.getOrderedExtensionList();
    const result = this.spawnCreep(body, name, { memory, energyStructures: extensions });
    CreepUtils.consoleLogIfWatched(this, `spawning: ${memory.role} ${CreepUtils.creepBodyToString(body)}`, result);
    if (result === ERR_INVALID_ARGS) {
      console.log(`Invalid spawn: ${memory.role} ${CreepUtils.creepBodyToString(body)}`);
    } else if (result === OK) {
      Memory.spawns[this.name].spawning = { name, body, memory };
      if (memory.replacing) {
        Game.creeps[memory.replacing].memory.retiring = true;
      }
    }
    return result;
  }

  private sortBody(body: BodyPartConstant[]): BodyPartConstant[] {
    return body.sort((a, b) => {
      return SpawnWrapper.BODY_PART_ORDER_LOOKUP[a] - SpawnWrapper.BODY_PART_ORDER_LOOKUP[b];
    });
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
