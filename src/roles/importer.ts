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
      // TODO work out a claim system for this
      this.targetRoom = TargetConfig.REMOTE_HARVEST[Game.shard.name][0];

      CreepUtils.consoleLogIfWatched(this, `no room targeted. sitting like a lump.`);
      return;
    }

    if (this.targetRoom) {
      // run home if hostiles seen
      if (this.room.find(FIND_HOSTILE_CREEPS).length > 0) {
        const moveResult = this.moveToRoom(this.homeRoom);
        const tower = this.pos.findClosestByPath(FIND_MY_STRUCTURES, {
          filter: structure => {
            return structure.structureType === STRUCTURE_TOWER && structure.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
          }
        });
        if (tower) {
          this.moveTo(tower);
        }
        CreepUtils.consoleLogIfWatched(this, `run from hostiles result`, moveResult);
        return;
      }
      const result = this.doHarvestJob();
      CreepUtils.consoleLogIfWatched(this, `job result`, result);
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
