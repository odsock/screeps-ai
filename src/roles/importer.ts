import { CreepRole } from "config/creep-types";
import { CreepUtils } from "creep-utils";
import { CreepBodyProfile } from "./creep-wrapper";
import { RemoteWorker } from "./remote-worker";
import { profile } from "../../screeps-typescript-profiler";

@profile
export class Importer extends RemoteWorker {
  public static readonly ROLE = CreepRole.IMPORTER;
  public static readonly BODY_PROFILE: CreepBodyProfile = {
    profile: [WORK, CARRY, CARRY, MOVE, MOVE, MOVE],
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

    // unsign controllers we didn't sign
    if (
      this.room.controller?.sign?.username &&
      this.room.controller.sign.username !== this.owner.username &&
      this.room.controller.sign.username !== "Screeps"
    ) {
      let result: ScreepsReturnCode;
      if (!this.pos.isNearTo(this.room.controller)) {
        result = this.moveTo(this.room.controller, { range: 1, reusePath: 20 });
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
      const harvestResult = this.doHarvestJob();
      CreepUtils.consoleLogIfWatched(this, `job result`, harvestResult);
      return;
    }
  }

  private doHarvestJob(): ScreepsReturnCode {
    this.updateJob("harvesting");
    this.startWorkingIfEmpty();
    this.stopWorkingIfFull();

    if (!this.memory.targetRoom || !this.memory.homeRoom) {
      CreepUtils.consoleLogIfWatched(this, `missing room configuration. sitting like a lump.`);
      return ERR_INVALID_ARGS;
    }

    let result: ScreepsReturnCode = OK;
    if (this.memory.working) {
      result = this.moveToRoom(this.memory.targetRoom);
      CreepUtils.consoleLogIfWatched(this, `move to target result`, result);
      if (this.pos.roomName === this.memory.targetRoom) {
        result = this.remoteHarvest();
      }
      return result;
    } else {
      result = this.moveToRoom(this.memory.homeRoom);
      CreepUtils.consoleLogIfWatched(this, `move home result`, result);
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

  private remoteHarvest(): ScreepsReturnCode {
    if (this.getActiveBodyparts(CARRY) === 0 || this.store.getFreeCapacity() === 0) {
      return ERR_FULL;
    }

    this.pickupAdjacentDroppedEnergy();
    this.withdrawAdjacentRuinOrTombEnergy();

    const target = this.findClosestActiveEnergySource() ?? this.findClosestEnergySource();

    let result = this.moveToAndGet(target);
    if (result === OK) {
      return result;
    }

    const inactiveSource = this.findClosestEnergySource();
    if (inactiveSource) {
      if (this.pos.isNearTo(inactiveSource)) {
        return OK;
      } else {
        result = this.moveTo(inactiveSource, { range: 1, reusePath: 10, visualizePathStyle: { stroke: "#ffaa00" } });
        CreepUtils.consoleLogIfWatched(this, `moving to inactive source: ${String(inactiveSource?.pos)}`, result);
        return result;
      }
    }

    this.say("🤔");
    CreepUtils.consoleLogIfWatched(this, `stumped. Just going to sit here.`);
    return ERR_NOT_FOUND;
  }
}
