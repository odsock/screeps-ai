import { CreepBodyProfile } from "./creep-wrapper";
import { CreepRole } from "config/creep-types";
import { CreepUtils } from "creep-utils";
import { RemoteCreepWrapper } from "./remote-creep-wrapper";

import { MemoryUtils } from "planning/memory-utils";
import { HaulTask, TaskType } from "../control/task-management";

export class Importer extends RemoteCreepWrapper {
  public static readonly ROLE = CreepRole.IMPORTER;
  public static readonly BODY_PROFILE: CreepBodyProfile = {
    profile: [MOVE, CARRY],
    seed: [],
    maxBodyParts: MAX_CREEP_SIZE
  };

  public run(): void {
    const fleeResult = this.fleeIfHostiles();
    if (fleeResult !== ERR_NOT_FOUND) {
      return;
    }
    const damagedResult = this.findHealingIfDamaged();
    if (damagedResult !== ERR_FULL) {
      return;
    }

    if (this.memory.task) {
      switch (this.memory.task.type) {
        case TaskType.HAUL:
          CreepUtils.consoleLogIfWatched(this, `haul harvester`, this.workHaulTask(this.memory.task));
          return;

        default:
          break;
      }
    }

    // TODO dry this up with claimer code and test cpu usage
    // unsign controllers we didn't sign
    if (
      this.room.controller?.sign?.username &&
      this.room.controller.sign.username !== this.owner.username &&
      this.room.controller.sign.username !== "Screeps"
    ) {
      let result: ScreepsReturnCode;
      if (!this.pos.isNearTo(this.room.controller)) {
        result = this.moveToW(this.room.controller, { range: 1, reusePath: 20 });
        CreepUtils.consoleLogIfWatched(this, `move result`, result);
      } else {
        result = this.signController(this.room.controller, "");
        CreepUtils.consoleLogIfWatched(this, `sign result`, result);
      }
      if (result === OK) {
        return;
      }
    }

    if (!this.memory.targetRoom) {
      CreepUtils.consoleLogIfWatched(this, `no room targeted. sitting like a lump.`);
      return;
    } else {
      const result = this.pickupCargo();
      CreepUtils.consoleLogIfWatched(this, `pickup cargo result`, result);
      return;
    }
  }

  private pickupCargo(): ScreepsReturnCode {
    this.startWorkingIfEmpty();
    this.stopWorkingIfFull();

    let result: ScreepsReturnCode = OK;
    if (this.memory.working) {
      result = this.moveToRoom(this.memory.targetRoom);
      CreepUtils.consoleLogIfWatched(this, `move to target room result`, result);
      if (this.pos.roomName === this.memory.targetRoom) {
        // TODO avoid withdrawing every tick rather than a single withdrawl when container has enough
        result = this.harvestByPriority();
        if (result === ERR_NOT_FOUND) {
          const closestSource = this.pos.findClosestByRange(this.roomw.sources);
          if (closestSource) {
            result = this.moveToW(closestSource, { range: 3 });
          }
        }
      }
      return result;
    } else {
      result = this.storeLoad();
    }
    return result;
  }

  // TODO dry this up with hauler storeLoad
  private storeLoad() {
    let result = this.moveToRoom(this.memory.homeRoom);
    CreepUtils.consoleLogIfWatched(this, `move to home room result`, result);
    if (this.pos.roomName === this.memory.homeRoom) {
      const storage = this.findRoomStorage();
      if (storage) {
        CreepUtils.consoleLogIfWatched(this, `storage found: ${String(storage)} ${String(storage.pos)}`);
        result = this.moveToAndTransfer(storage);
        CreepUtils.consoleLogIfWatched(this, `fill storage result`, result);
      } else {
        CreepUtils.consoleLogIfWatched(this, `no storage found. sitting like a lump.`);
        result = ERR_FULL;
      }
    }
    return result;
  }

  // TODO dry up with hauler code
  private workHaulTask(haulTask: HaulTask): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `haul ${String(haulTask.creepName)}`);

    // TODO validation here may cause idle tick when haul ends
    CreepUtils.consoleLogIfWatched(this, `validate haul request `);
    const creepToHaul = Game.creeps[haulTask.creepName];
    if (!creepToHaul || !creepToHaul.memory.haulRequested) {
      CreepUtils.consoleLogIfWatched(this, `haul request invalid`);
      if (creepToHaul) {
        creepToHaul.memory.haulRequested = false;
        creepToHaul.memory.haulerName = undefined;
      }
      this.completeTask();
      return ERR_INVALID_TARGET;
    } else {
      creepToHaul.memory.haulerName = this.name;
    }

    if (this.store.getUsedCapacity() > 0) {
      return this.storeLoad();
    }

    // start working when near cargo
    if (this.pos.isNearTo(creepToHaul.pos)) {
      this.memory.working = true;
    } else if (this.memory.working && !this.memory.exitState) {
      // if not near cargo, and not in exit proccess, need to walk back to cargo
      this.memory.working = false;
    }

    if (!this.memory.working) {
      // step away from exit if just crossed over and not hauling yet. Prevents room swap loop with cargo creep.
      if (this.memory.lastPos && this.pos.roomName !== MemoryUtils.unpackRoomPosition(this.memory.lastPos).roomName) {
        const exitDir = CreepUtils.getClosestExitDirection(this.pos);
        if (exitDir) {
          const reverseExitDir = CreepUtils.reverseDirection(exitDir);
          const result = this.moveW(reverseExitDir);
          CreepUtils.consoleLogIfWatched(this, `move away from exit`, result);
          return result;
        }
      }
      const result = this.moveToW(creepToHaul);
      CreepUtils.consoleLogIfWatched(this, `move to creep`, result);
    }
    return OK;
  }
}
