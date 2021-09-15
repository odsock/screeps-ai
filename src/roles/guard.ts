import { CreepRole } from "config/creep-types";
import { CreepUtils } from "creep-utils";
import { RemoteWorker } from "./remote-worker";

export class Guard extends RemoteWorker {
  public static readonly ROLE = CreepRole.GUARD;
  public static readonly BODY_PROFILE: CreepBodyProfile = {
    profile: [],
    seed: [TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, ATTACK],
    maxBodyParts: MAX_CREEP_SIZE
  };

  public run(): void {
    // use current room for home (room spawned in)
    if (!this.homeRoom) {
      this.homeRoom = this.pos.roomName;
    }

    // check for flagged scary rooms
    if (!this.targetRoom) {
      for (const roomName in Memory.rooms) {
        const hostiles = Memory.rooms[roomName].defense.hostiles;
        if (hostiles.length > 0) {
          const guard = _.find(
            Game.creeps,
            creep => creep.memory.role === Guard.ROLE && creep.memory.targetRoom === roomName
          );
          if (!guard) {
            this.targetRoom = roomName;
          }
        }
      }
    }

    if (this.roomw.hasHostiles) {
      const closestHostile = this.pos.findClosestByPath(this.roomw.hostileCreeps);
      if (closestHostile) {
        const attackResult = this.moveToAndAttack(closestHostile);
        CreepUtils.consoleLogIfWatched(this, `attack`, attackResult);
        return;
      }
    } else {
      this.room.memory.defense.hostiles = [];
    }

    if (!this.targetRoom) {
      CreepUtils.consoleLogIfWatched(this, `no room targeted. sitting like a lump.`);
      return;
    } else {
      const result = this.moveToRoom(this.targetRoom);
      CreepUtils.consoleLogIfWatched(this, `move to target room`, result);
      return;
    }
  }
}
