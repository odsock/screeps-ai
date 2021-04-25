import { CreepWrapper } from "./creep-wrapper";
import { CreepUtils } from "creep-utils";
import { TargetConfig } from "target-config";

export class Claimer extends CreepWrapper {
  public run(): void {
    this.touchRoad();

    // make sure we have a target room
    const targetRoom = this.getTargetRoom();
    if (!targetRoom) {
      CreepUtils.consoleLogIfWatched(this, `no room targeted for claiming. sitting like a lump.`);
      return;
    }

    // go to the room if not in it
    if (this.pos.roomName !== targetRoom) {
      const exitDirection = this.roomw.findExitTo(targetRoom);
      if (exitDirection === -2 || exitDirection === -10) {
        CreepUtils.consoleLogIfWatched(this, `can't get to room: ${targetRoom}, error: ${exitDirection}`);
        return;
      }
      const exitPos = this.pos.findClosestByPath(exitDirection);
      if (!exitPos) {
        CreepUtils.consoleLogIfWatched(this, `can't find exit to room: ${targetRoom}`);
        return;
      }
      const ret = this.moveTo(exitPos);
      CreepUtils.consoleLogIfWatched(this, `moving to exit: ${String(exitPos)}, ret: ${ret}`);
      return;
    }

    // go to controller and claim it
    if (this.roomw.controller) {
      const ret = this.moveTo(this.roomw.controller);
      CreepUtils.consoleLogIfWatched(this, `moving to controller: ${String(this.roomw.controller)}, ret: ${ret}`);
      const claimRet = this.claimController(this.roomw.controller);
      CreepUtils.consoleLogIfWatched(this, `claiming controller: ${String(this.roomw.controller)}, ret: ${claimRet}`);
      return;
    }
  }

  private getTargetRoom(): string | undefined {
    if (!this.memory.targetRoom) {
      // find a target room
      const targetRooms: string[] = TargetConfig.TARGETS[Game.shard.name];
      const targetRoomsNotOwned = targetRooms.filter(r => !Game.rooms[r]);

      // store my target room in my memory
      this.memory.targetRoom = targetRoomsNotOwned[0];
    }
    return this.memory.targetRoom;
  }
}
