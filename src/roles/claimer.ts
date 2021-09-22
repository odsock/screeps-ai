import { CreepRole } from "config/creep-types";
import { SockPuppetConstants } from "config/sockpuppet-constants";
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
    CreepUtils.consoleLogIfWatched(this, `running ${this.name}`);

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
    CreepUtils.consoleLogIfWatched(this, `target room ${targetRoom}`);

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
    if (this.memory.targetRoom) {
      return this.memory.targetRoom;
    }

    // get list of rooms targeted by other claimers
    const targetedRooms = _.filter(
      Game.creeps,
      creep => creep.memory.role === Claimer.ROLE && creep.memory.targetRoom
    ).map(creep => creep.memory.targetRoom);

    // find a target or remote not in the list
    let targetRoom = TargetConfig.TARGETS[Game.shard.name].find(target => !targetedRooms.includes(target));
    if (!targetRoom) {
      targetRoom = TargetConfig.REMOTE_HARVEST[Game.shard.name].find(target => !targetedRooms.includes(target));
    }

    // store my target room in my memory
    if (targetRoom) {
      this.memory.targetRoom = targetRoom;
      return targetRoom;
    }
    return undefined;
  }
}
