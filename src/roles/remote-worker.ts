import { CreepWrapper } from "./creep-wrapper";
import { CreepUtils } from "creep-utils";
import { TargetConfig } from "target-config";

export class RemoteWorker extends CreepWrapper {
  public run(): void {
    throw new Error("Superclass run not implemented.");
  }

  private _targetRoom: string | undefined;
  private _homeRoom: string | undefined;

  protected get targetRoom(): string | undefined {
    if (!this._targetRoom) {
      // check memory
      if (this.memory.targetRoom) {
        this._targetRoom = this.memory.targetRoom;
      } else {
        // find a target room
        const targetRooms: string[] = TargetConfig.TARGETS[Game.shard.name];
        const targetRoomsNotOwned = targetRooms.filter(r => !Game.rooms[r]);

        // store my target room in my memory
        this._targetRoom = targetRoomsNotOwned[0];
        this.memory.targetRoom = this._targetRoom;
      }
    }
    return this._targetRoom;
  }

  protected get homeRoom(): string {
    if (!this._homeRoom) {
      // check memory
      if (this.memory.homeRoom) {
        this._homeRoom = this.memory.homeRoom;
      } else {
        // set current room as home (hopefully room where spawned)
        this._homeRoom = this.pos.roomName;
        this.memory.homeRoom = this._homeRoom;
      }
    }
    return this._homeRoom;
  }

  protected moveToTargetRoom(): ScreepsReturnCode {
    if (!this.targetRoom) {
      CreepUtils.consoleLogIfWatched(this, `no target room`);
      return ERR_NOT_FOUND;
    }

    if (this.pos.roomName !== this.targetRoom) {
      CreepUtils.consoleLogIfWatched(this, `in target room`);
      return OK;
    }

    const exitDirection = this.roomw.findExitTo(this.targetRoom);
    if (exitDirection === ERR_NO_PATH || exitDirection === ERR_INVALID_ARGS) {
      CreepUtils.consoleLogResultIfWatched(this, `can't get to room: ${this.targetRoom}`, exitDirection);
      return exitDirection;
    }
    const exitPos = this.pos.findClosestByPath(exitDirection);
    if (!exitPos) {
      CreepUtils.consoleLogIfWatched(this, `can't find exit to room: ${this.targetRoom}`);
      return ERR_NO_PATH;
    }
    const ret = this.moveTo(exitPos);
    CreepUtils.consoleLogResultIfWatched(this, `moving to exit: ${String(exitPos)}`, ret);
    return ret;
  }

  protected moveToHomeRoom(): ScreepsReturnCode {
    if (!this.targetRoom) {
      CreepUtils.consoleLogIfWatched(this, `no target room`);
      return ERR_NOT_FOUND;
    }

    if (this.pos.roomName !== this.targetRoom) {
      CreepUtils.consoleLogIfWatched(this, `in target room`);
      return OK;
    }

    const exitDirection = this.roomw.findExitTo(this.targetRoom);
    if (exitDirection === ERR_NO_PATH || exitDirection === ERR_INVALID_ARGS) {
      CreepUtils.consoleLogResultIfWatched(this, `can't get to room: ${this.targetRoom}`, exitDirection);
      return exitDirection;
    }
    const exitPos = this.pos.findClosestByPath(exitDirection);
    if (!exitPos) {
      CreepUtils.consoleLogIfWatched(this, `can't find exit to room: ${this.targetRoom}`);
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
