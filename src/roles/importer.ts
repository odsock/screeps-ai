import { CreepBodyProfile } from "./creep-wrapper";
import { CreepRole } from "config/creep-types";
import { CreepUtils } from "creep-utils";
import { RemoteCreepWrapper } from "./remote-creep-wrapper";
import { profile } from "../../screeps-typescript-profiler";

@profile
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
      result = this.moveToRoom(this.memory.homeRoom);
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
    }
    return result;
  }
}
