import { CreepRole } from "config/creep-types";
import { TargetConfig } from "config/target-config";
import { CreepUtils } from "creep-utils";
import { CreepBodyProfile } from "./creep-wrapper";
import { RemoteWorker } from "./remote-worker";

export class Claimer extends RemoteWorker {
  public static readonly ROLE = CreepRole.CLAIMER;
  public static readonly BODY_PROFILE: CreepBodyProfile = {
    profile: [MOVE, CLAIM],
    seed: [],
    maxBodyParts: 4
  };

  public run(): void {
    // unsign controllers we didn't sign
    if (this.room.controller?.sign?.username && this.room.controller.sign.username !== this.owner.username) {
      this.moveTo(this.room.controller);
      this.signController(this.room.controller, "");
    }

    // make sure we have a target room
    const targetRoom = this.getTargetRoom();
    if (!targetRoom) {
      CreepUtils.consoleLogIfWatched(this, `no room targeted for claiming. sitting like a lump.`);
      return;
    }

    // go to the room if not in it
    if (this.pos.roomName !== targetRoom) {
      const result = this.moveToRoom(targetRoom);
      CreepUtils.consoleLogIfWatched(this, `move to target room ${targetRoom}`, result);
      return;
    }

    // go to controller and claim or reserve it
    if (this.roomw.controller) {
      const claimFlag = TargetConfig.TARGETS[Game.shard.name].includes(targetRoom);
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

  private getTargetRoom(): string | undefined {
    let targetRoom = this.memory.targetRoom;
    if (!targetRoom) {
      // find a target room
      targetRoom = this.roomw.getRoomClaim(this);

      if (targetRoom) {
        // store my target room in my memory
        this.memory.targetRoom = targetRoom;
      }
    }
    return targetRoom;
  }
}
