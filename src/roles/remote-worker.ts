import { CreepWrapper } from "./creep-wrapper";
import { CreepUtils } from "creep-utils";
import { TargetConfig } from "target-config";

export class RemoteWorker extends CreepWrapper {
  public run(): void {
    throw new Error("Superclass run not implemented.");
  }

  private _targetRoom: string | undefined;
  private _homeRoom: string | undefined;

  protected set targetRoom(roomName: string | undefined) {
    this._targetRoom = roomName;
    this.memory.targetRoom = this._targetRoom;
  }

  protected get targetRoom(): string  | undefined{
    if (this._targetRoom) {
      return this._targetRoom;
    }

    if (this.memory.targetRoom) {
      this._targetRoom = this.memory.targetRoom;
      return this._targetRoom;
    }

    return undefined;
  }

  protected set homeRoom(roomName: string | undefined) {
    this._homeRoom = roomName;
    this.memory.homeRoom = this._homeRoom;
  }

  protected get homeRoom(): string  | undefined{
    if (this._homeRoom) {
      return this._homeRoom;
    }

    if (this.memory.homeRoom) {
      this._homeRoom = this.memory.homeRoom;
      return this._homeRoom;
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
      CreepUtils.consoleLogResultIfWatched(this, `can't get to room: ${roomName}`, exitDirection);
      return exitDirection;
    }
    const exitPos = this.pos.findClosestByPath(exitDirection);
    if (!exitPos) {
      CreepUtils.consoleLogIfWatched(this, `can't find exit to room: ${roomName}`);
      return ERR_NO_PATH;
    }
    const ret = this.moveTo(exitPos);
    CreepUtils.consoleLogResultIfWatched(this, `moving to exit: ${String(exitPos)}`, ret);
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
    CreepUtils.consoleLogResultIfWatched(this, `moving to controller: ${String(this.roomw.controller.pos)}`, ret);
    const claimRet = this.claimController(this.roomw.controller);
    CreepUtils.consoleLogResultIfWatched(this, `claiming controller: ${String(this.roomw.controller.pos)}`, claimRet);
    return ret;
  }
}
