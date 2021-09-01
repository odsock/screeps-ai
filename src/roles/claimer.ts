import { CreepUtils } from "creep-utils";
import { CreepRole } from "../spawn-control";
import { TargetConfig } from "target-config";
import { RemoteWorker } from "./remote-worker";
import { RoomWrapper } from "structures/room-wrapper";

export class Claimer extends RemoteWorker {
  public static readonly ROLE = CreepRole.CLAIMER;
  public static readonly BODY_PROFILE: CreepBodyProfile = {
    profile: [MOVE, CLAIM],
    seed: [],
    maxBodyParts: 4
  };

  public run(): void {
    // don't carry target room to grave
    if (this.ticksToLive === 1 && this.targetRoom && this.homeRoom) {
      new RoomWrapper(Game.rooms[this.homeRoom]).releaseRoomClaim(this.targetRoom);
    }

    const fleeResult = this.fleeIfHostiles();
    if (fleeResult !== ERR_NOT_FOUND) {
      return;
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
      if (TargetConfig.TARGETS[Game.shard.name].includes(targetRoom)) {
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
      targetRoom = this.roomw.getRoomClaim();

      if (targetRoom) {
        // store my target room in my memory
        this.memory.targetRoom = targetRoom;
      }
    }
    return targetRoom;
  }
}
