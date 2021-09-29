import { CreepRole } from "config/creep-types";
import { CreepUtils } from "creep-utils";
import { CreepBodyProfile } from "./creep-wrapper";
import { RemoteWorker } from "./remote-worker";
import { profile } from "../../screeps-typescript-profiler";

@profile
export class Guard extends RemoteWorker {
  public static readonly ROLE = CreepRole.GUARD;
  public static readonly BODY_PROFILE: CreepBodyProfile = {
    profile: [TOUGH, MOVE, MOVE, ATTACK],
    seed: [TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, ATTACK],
    maxBodyParts: MAX_CREEP_SIZE
  };

  public run(): void {
    // use current room for home (room spawned in)
    if (!this.memory.homeRoom) {
      this.memory.homeRoom = this.pos.roomName;
    }

    // check for flagged scary rooms
    if (!this.memory.targetRoom) {
      for (const roomName in Memory.rooms) {
        const defenseMemory = Memory.rooms[roomName].defense;
        if (defenseMemory) {
          const hostiles = defenseMemory.creeps;
          if (hostiles.length > 0) {
            const guard = _.find(
              Game.creeps,
              creep => creep.memory.role === Guard.ROLE && creep.memory.targetRoom === roomName
            );
            if (!guard) {
              this.memory.targetRoom = roomName;
            }
          }
        }
      }
    }

    if (this.roomw.hasHostiles) {
      const creeps = this.roomw.hostileCreeps;
      const structures = this.roomw.hostileStructures;
      let target: Creep | AnyOwnedStructure | null;
      if (creeps.length) {
        target = this.pos.findClosestByPath(creeps);
      } else {
        target = this.pos.findClosestByPath(structures);
      }
      if (target) {
        const attackResult = this.moveToAndAttack(target);
        CreepUtils.consoleLogIfWatched(this, `attack`, attackResult);
        return;
      }
    }

    if (!this.memory.targetRoom) {
      CreepUtils.consoleLogIfWatched(this, `no room targeted. sitting like a lump.`);
      return;
    } else {
      const result = this.moveToRoom(this.memory.targetRoom);
      CreepUtils.consoleLogIfWatched(this, `move to target room`, result);
      return;
    }
  }
}
