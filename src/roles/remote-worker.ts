import { CreepUtils } from "creep-utils";
import { CreepWrapper } from "./creep-wrapper";
import { profile } from "../../screeps-typescript-profiler";

@profile
export class RemoteWorker extends CreepWrapper {
  public run(): void {
    throw new Error("Superclass run not implemented.");
  }

  protected moveToRoom(roomName: string): ScreepsReturnCode {
    if (this.pos.roomName === roomName) {
      delete this.memory.path;
      CreepUtils.consoleLogIfWatched(this, `already in room ${roomName}`);
      return OK;
    }

    if (!this.memory.path || this.memory.path.length === 0) {
      const result = this.getPathToRoom(roomName);
      if (result !== OK) {
        return result;
      }
    }

    if (this.memory.path) {
      const path = Room.deserializePath(this.memory.path);
      const lastPos = this.memory.lastPos;
      console.log(`DEBUG: lastPos: ${JSON.stringify(lastPos)}, this.pos: ${JSON.stringify(this.pos)}`);
      if (lastPos && this.pos.isEqualTo(lastPos)) {
        console.log(`DEBUG: stuck`);
        this.memory.stuckCount = (this.memory.stuckCount ?? 0) + 1;
      }
      if ((this.memory.stuckCount ?? 0) > 2) {
        delete this.memory.path;
      }
      this.memory.lastPos = this.pos;

      const ret = this.moveByPath(path);
      CreepUtils.consoleLogIfWatched(this, `moving to exit by path`, ret);
      return ret;
    }

    return ERR_NOT_FOUND;
  }

  protected getPathToRoom(roomName: string): ScreepsReturnCode {
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

    const path = this.pos.findPathTo(exitPos);
    this.memory.path = Room.serializePath(path);
    return OK;
  }

  protected claimTargetRoom(): ScreepsReturnCode {
    if (this.room.name !== this.memory.targetRoom) {
      return ERR_NOT_IN_RANGE;
    }

    if (!this.roomw.controller) {
      return ERR_INVALID_TARGET;
    }

    // go to controller and claim it
    let result: ScreepsReturnCode = this.claimController(this.roomw.controller);
    CreepUtils.consoleLogIfWatched(this, `claiming controller: ${String(this.roomw.controller.pos)}`, result);
    if (result === ERR_NOT_IN_RANGE) {
      result = this.moveTo(this.roomw.controller);
      CreepUtils.consoleLogIfWatched(this, `moving to controller: ${String(this.roomw.controller.pos)}`, result);
    }
    return result;
  }

  protected reserveTargetRoom(): ScreepsReturnCode {
    if (this.room.name !== this.memory.targetRoom) {
      return ERR_NOT_IN_RANGE;
    }

    if (!this.roomw.controller) {
      return ERR_INVALID_TARGET;
    }

    // go to controller and reserve it
    let result: ScreepsReturnCode = this.reserveController(this.roomw.controller);
    CreepUtils.consoleLogIfWatched(this, `reserving controller: ${String(this.roomw.controller.pos)}`, result);
    if (result === ERR_NOT_IN_RANGE) {
      result = this.moveTo(this.roomw.controller);
      CreepUtils.consoleLogIfWatched(this, `moving to controller: ${String(this.roomw.controller.pos)}`, result);
    }
    return result;
  }

  /**
   * Returns creep to tower in home room if hostile creeps seen.
   * @returns ScreepsReturnCode
   */
  // TODO dry up flee and find healing
  protected fleeIfHostiles(): ScreepsReturnCode {
    if (!this.roomw.hasHostiles) {
      return ERR_NOT_FOUND;
    }
    CreepUtils.consoleLogIfWatched(this, `room has hostile creeps!`);

    if (this.memory.homeRoom) {
      const result = this.moveToRoom(this.memory.homeRoom);
      CreepUtils.consoleLogIfWatched(this, `returning to home room`, result);
    }

    const tower = this.pos.findClosestByPath(FIND_MY_STRUCTURES, {
      filter: structure => structure.structureType === STRUCTURE_TOWER
    });
    if (tower) {
      const result = this.moveTo(tower, { range: 2, reusePath: 10 });
      CreepUtils.consoleLogIfWatched(this, `moving to tower`, result);
      return result;
    }

    return ERR_INVALID_TARGET;
  }

  /**
   * Returns creep to tower in home room if damaged.
   * @returns ScreepsReturnCode
   */
  protected findHealingIfDamaged(): ScreepsReturnCode {
    if (this.hits === this.hitsMax) {
      return ERR_FULL;
    }
    CreepUtils.consoleLogIfWatched(this, `hits ${this.hits}/${this.hitsMax}`);

    if (this.memory.homeRoom) {
      const result = this.moveToRoom(this.memory.homeRoom);
      CreepUtils.consoleLogIfWatched(this, `returning to home room`, result);
    }

    const tower = this.pos.findClosestByPath(FIND_MY_STRUCTURES, {
      filter: structure => structure.structureType === STRUCTURE_TOWER
    });
    if (tower) {
      const result = this.moveTo(tower, { range: 5, reusePath: 10 });
      CreepUtils.consoleLogIfWatched(this, `moving to tower`, result);
      return result;
    }

    return ERR_INVALID_TARGET;
  }
}
