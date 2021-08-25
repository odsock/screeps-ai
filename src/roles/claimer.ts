import { CreepUtils } from "creep-utils";
import { TargetConfig } from "target-config";
import { RemoteWorker } from "./remote-worker";

export class Claimer extends RemoteWorker {
  public run(): void {
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

    // go to controller and claim it
    if (this.roomw.controller) {
      // const result = this.claimTargetRoom();
      // CreepUtils.consoleLogIfWatched(this, `claim controller: ${String(this.roomw.controller)}`, result);
      const result = this.reserveTargetRoom();
      CreepUtils.consoleLogIfWatched(this, `reserve controller: ${String(this.roomw.controller)}`, result);
      return;
    }
  }

  private getTargetRoom(): string | undefined {
    if (!this.memory.targetRoom) {
      // find a target room
      const targetRooms: string[] = TargetConfig.TARGETS[Game.shard.name];
      const targetRoomsNotOwned = targetRooms.filter(r => !Game.rooms[r].controller?.my);

      // store my target room in my memory
      this.memory.targetRoom = targetRoomsNotOwned[0];
    }
    return this.memory.targetRoom;
  }
}
