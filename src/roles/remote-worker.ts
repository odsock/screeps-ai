import { CreepWrapper } from "./creep-wrapper";
import { CreepUtils } from "creep-utils";

export class RemoteWorker extends CreepWrapper {
  public run(): void {
    throw new Error("Superclass run not implemented.");
  }

  private targetRoomCache: string | undefined;
  private homeRoomCache: string | undefined;

  protected set targetRoom(roomName: string | undefined) {
    this.targetRoomCache = roomName;
    this.memory.targetRoom = this.targetRoomCache;
  }

  protected get targetRoom(): string | undefined {
    if (this.targetRoomCache) {
      return this.targetRoomCache;
    }

    if (this.memory.targetRoom) {
      this.targetRoomCache = this.memory.targetRoom;
      return this.targetRoomCache;
    }

    return undefined;
  }

  protected set homeRoom(roomName: string | undefined) {
    this.homeRoomCache = roomName;
    this.memory.homeRoom = this.homeRoomCache;
  }

  protected get homeRoom(): string | undefined {
    if (this.homeRoomCache) {
      return this.homeRoomCache;
    }

    if (this.memory.homeRoom) {
      this.homeRoomCache = this.memory.homeRoom;
      return this.homeRoomCache;
    }

    return undefined;
  }

  protected moveToRoom(roomName: string): ScreepsReturnCode {
    if (this.pos.roomName === roomName) {
      CreepUtils.consoleLogIfWatched(this, `already in room ${roomName}`);
      return OK;
    }

    const exitDirection = this.roomw.findExitTo(roomName);
    if (exitDirection === ERR_NO_PATH || exitDirection === ERR_INVALID_ARGS) {
      CreepUtils.consoleLogIfWatched(this, `can't get to room: ${roomName}`, exitDirection);
      return exitDirection;
    }
    const exitPos = this.pos.findClosestByPath(exitDirection);
    if (!exitPos) {
      CreepUtils.consoleLogIfWatched(this, `can't find exit to room: ${roomName}`);
      return ERR_NO_PATH;
    }
    const ret = this.moveTo(exitPos);
    CreepUtils.consoleLogIfWatched(this, `moving to exit: ${String(exitPos)}`, ret);
    return ret;
  }

  protected claimTargetRoom(): ScreepsReturnCode {
    if (this.room.name !== this.targetRoom) {
      return ERR_NOT_IN_RANGE;
    }

    if (!this.roomw.controller) {
      return ERR_INVALID_TARGET;
    }

    // go to controller and claim it
    const ret = this.moveTo(this.roomw.controller);
    CreepUtils.consoleLogIfWatched(this, `moving to controller: ${String(this.roomw.controller.pos)}`, ret);
    const claimRet = this.claimController(this.roomw.controller);
    CreepUtils.consoleLogIfWatched(this, `claiming controller: ${String(this.roomw.controller.pos)}`, claimRet);
    return ret;
  }
}
