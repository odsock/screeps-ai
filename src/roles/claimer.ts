import { CreepRole } from "config/creep-types";
import { TargetConfig } from "config/target-config";
import { CreepUtils } from "creep-utils";
import { profile } from "../../screeps-typescript-profiler";
import { CreepBodyProfile } from "./creep-wrapper";
import { RemoteWorker } from "./remote-worker";

@profile
export class Claimer extends RemoteWorker {
  public static readonly ROLE = CreepRole.CLAIMER;
  public static readonly BODY_PROFILE: CreepBodyProfile = {
    profile: [MOVE, CLAIM],
    seed: [],
    maxBodyParts: 4
  };

  public run(): void {
    CreepUtils.consoleLogIfWatched(this, `running ${this.name}`);

    // unsign controllers we didn't sign
    if (this.room.controller?.sign?.username && this.room.controller.sign.username !== this.owner.username) {
      this.moveTo(this.room.controller);
      this.signController(this.room.controller, "");
    }

    // make sure we have a target room
    if (!this.memory.targetRoom) {
      CreepUtils.consoleLogIfWatched(this, `no room targeted for claiming. sitting like a lump.`);
      return;
    }
    CreepUtils.consoleLogIfWatched(this, `target room ${this.memory.targetRoom}`);

    // go to the room if not in it
    if (this.pos.roomName !== this.memory.targetRoom) {
      const result = this.moveToRoom(this.memory.targetRoom);
      CreepUtils.consoleLogIfWatched(this, `move to target room ${this.memory.targetRoom}`, result);
      return;
    }

    // go to controller and claim or reserve it
    if (this.roomw.controller) {
      const claimFlag = TargetConfig.TARGETS[Game.shard.name].includes(this.memory.targetRoom);
      CreepUtils.consoleLogIfWatched(this, `claim target room? ${String(claimFlag)}`);
      if (claimFlag) {
        const result = this.claimTargetRoom();
        CreepUtils.consoleLogIfWatched(this, `claim controller: ${String(this.roomw.controller)}`, result);
      } else {
        const reserveResult = this.reserveTargetRoom();
        CreepUtils.consoleLogIfWatched(this, `reserve controller: ${String(this.roomw.controller)}`, reserveResult);
      }
      return;
    }
  }
}
