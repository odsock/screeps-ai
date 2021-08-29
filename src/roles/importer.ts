import { CreepUtils } from "creep-utils";
import { CreepRole } from "../spawn-control";
import { TargetConfig } from "target-config";
import { RemoteWorker } from "./remote-worker";

export class Importer extends RemoteWorker {
  public static readonly ROLE = CreepRole.IMPORTER;
  public static readonly BODY_PROFILE: CreepBodyProfile = {
    profile: [WORK, CARRY, MOVE, MOVE],
    seed: [],
    maxBodyParts: MAX_CREEP_SIZE
  };

  public run(): void {
    // use current room for home (room spawned in)
    if (!this.homeRoom) {
      this.homeRoom = this.pos.roomName;
    }

    const result = this.fleeIfHostiles();
    if (result !== ERR_NOT_FOUND) {
      return;
    }

    const damagedResult = this.findHealingIfDamaged();
    if (damagedResult !== ERR_FULL) {
      return;
    }

    if (!this.targetRoom) {
      // TODO work out a claim system for this
      this.targetRoom = TargetConfig.REMOTE_HARVEST[Game.shard.name][0];
    }

    if (!this.targetRoom) {
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

    if (!this.targetRoom || !this.homeRoom) {
      CreepUtils.consoleLogIfWatched(this, `missing room configuration. sitting like a lump.`);
      return ERR_INVALID_ARGS;
    }

    let result: ScreepsReturnCode = OK;
    if (this.memory.working) {
      result = this.moveToRoom(this.targetRoom);
      CreepUtils.consoleLogIfWatched(this, `move to target result`, result);
      if (this.pos.roomName === this.targetRoom) {
        result = this.harvestByPriority();
      }
      return result;
    } else {
      result = this.moveToRoom(this.homeRoom);
      CreepUtils.consoleLogIfWatched(this, `move home result`, result);
      if (this.pos.roomName === this.homeRoom) {
        const storage = this.findRoomStorage();
        if (storage) {
          CreepUtils.consoleLogIfWatched(this, `storage found: ${storage.structureType} ${String(storage.pos)}`);
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
