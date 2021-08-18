import { CreepUtils } from "creep-utils";
import { TargetConfig } from "target-config";
import { RemoteWorker } from "./remote-worker";

export class Importer extends RemoteWorker {
  public run(): void {
    // use current room for home (room spawned in)
    if (!this.homeRoom) {
      this.homeRoom = this.pos.roomName;
    }

    if (!this.targetRoom) {
      this.targetRoom = TargetConfig.REMOTE_HARVEST[Game.shard.name].pop();

      CreepUtils.consoleLogIfWatched(this, `no room targeted. sitting like a lump.`);
      return;
    }

    if (this.targetRoom) {
      CreepUtils.consoleLogIfWatched(this, "harvesting job");
      const result = this.doHarvestJob();
      CreepUtils.consoleLogResultIfWatched(this, `job result`, result);
      return;
    }

    // move to active source
    // harvest until full
    // move to home room
    // move to container with space
    // transfer resource
    // repeat until death
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
      CreepUtils.consoleLogResultIfWatched(this, `move to target result`, result);
      if (this.pos.roomName === this.targetRoom) {
        result = this.harvestByPriority();
      }
      return result;
    } else {
      result = this.moveToRoom(this.homeRoom);
      CreepUtils.consoleLogResultIfWatched(this, `move home result`, result);
      if (this.pos.roomName === this.homeRoom) {
        const storage = this.findRoomStorage();
        if (storage) {
          result = this.moveToAndTransfer(storage);
          CreepUtils.consoleLogResultIfWatched(this, `fill storage result`, result);
        } else {
          CreepUtils.consoleLogIfWatched(this, `no storage found. sitting like a lump.`);
          result = ERR_FULL;
        }
      }
    }
    return result;
  }
}
