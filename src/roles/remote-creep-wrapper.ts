import { CreepUtils } from "creep-utils";
import { CreepWrapper } from "./creep-wrapper";

export class RemoteCreepWrapper extends CreepWrapper {
  public run(): void {
    throw new Error("Superclass run not implemented.");
  }

  protected reserveTargetRoom(): ScreepsReturnCode {
    if (this.room.name !== this.memory.targetRoom) {
      return ERR_NOT_IN_RANGE;
    }

    if (!this.roomw.controller) {
      return ERR_INVALID_TARGET;
    }

    if (
      (this.roomw.controller.owner && this.roomw.controller.owner.username !== Memory.username) ||
      (this.roomw.controller.reservation && this.roomw.controller.reservation.username !== Memory.username)
    ) {
      // go to controller and attack it
      let result: ScreepsReturnCode = this.attackController(this.roomw.controller);
      CreepUtils.consoleLogIfWatched(this, `attacking controller: ${String(this.roomw.controller.pos)}`, result);
      if (result === ERR_NOT_IN_RANGE) {
        result = this.moveToW(this.roomw.controller);
        CreepUtils.consoleLogIfWatched(this, `moving to controller: ${String(this.roomw.controller.pos)}`, result);
      }
      return result;
    }

    // go to controller and reserve it
    let result: ScreepsReturnCode = this.reserveController(this.roomw.controller);
    CreepUtils.consoleLogIfWatched(this, `reserving controller: ${String(this.roomw.controller.pos)}`, result);
    if (result === ERR_NOT_IN_RANGE) {
      result = this.moveToW(this.roomw.controller);
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
    if (!this.roomw.hasHostileCreeps) {
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
      const result = this.moveToW(tower, { range: 2 });
      CreepUtils.consoleLogIfWatched(this, `moving to tower`, result);
      return result;
    }

    return ERR_INVALID_TARGET;
  }

  protected fleeIfArmedTowers(): ScreepsReturnCode {
    if (!this.roomw.hasArmedTowers) {
      return ERR_NOT_FOUND;
    }
    CreepUtils.consoleLogIfWatched(this, `room has armed towers!`);

    if (this.memory.rallyRoom) {
      const result = this.moveToRoom(this.memory.rallyRoom);
      CreepUtils.consoleLogIfWatched(this, `returning to rally room`, result);
      return result;
    } else if (this.memory.homeRoom) {
      const result = this.moveToRoom(this.memory.homeRoom);
      CreepUtils.consoleLogIfWatched(this, `returning to home room`, result);
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
      const result = this.moveToW(tower, { range: 5 });
      CreepUtils.consoleLogIfWatched(this, `moving to tower`, result);
      return result;
    }

    return ERR_INVALID_TARGET;
  }
}
