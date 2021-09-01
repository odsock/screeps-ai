import { CreepUtils } from "creep-utils";
import { CreepRole } from "../constants";
import { TargetConfig } from "target-config";
import { RemoteWorker } from "./remote-worker";

export class Guard extends RemoteWorker {
  public static readonly ROLE = CreepRole.GUARD;
  public static readonly BODY_PROFILE: CreepBodyProfile = {
    profile: [TOUGH, ATTACK, RANGED_ATTACK, MOVE, MOVE, MOVE],
    seed: [],
    maxBodyParts: MAX_CREEP_SIZE
  };

  public run(): void {
    // use current room for home (room spawned in)
    if (!this.homeRoom) {
      this.homeRoom = this.pos.roomName;
    }

    if (!this.targetRoom) {
      // TODO work out a claim system for this
      this.targetRoom = TargetConfig.REMOTE_HARVEST[Game.shard.name][0];
    }

    if (this.roomw.hasHostiles) {
      const closestHostile = this.pos.findClosestByPath(this.roomw.hostileCreeps);
      if (closestHostile) {
        const attackResult = this.moveToAndAttack(closestHostile);
        CreepUtils.consoleLogIfWatched(this, `attack`, attackResult);
        return;
      }
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
