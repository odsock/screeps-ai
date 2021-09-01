import { CreepUtils } from "creep-utils";
import { RoomWrapper } from "structures/room-wrapper";
import { CreepRole } from "../spawn-control";
import { RemoteWorker } from "./remote-worker";

export class Importer extends RemoteWorker {
  public static readonly ROLE = CreepRole.IMPORTER;
  public static readonly BODY_PROFILE: CreepBodyProfile = {
    profile: [WORK, CARRY, MOVE, MOVE],
    seed: [],
    maxBodyParts: MAX_CREEP_SIZE
  };

  public run(): void {
    // don't carry target room to grave
    if (this.ticksToLive === 1 && this.targetRoom && this.homeRoom) {
      new RoomWrapper(Game.rooms[this.homeRoom]).releaseRoomClaim(this.targetRoom);
    }

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

    // make sure we have a target room
    const targetRoom = this.getTargetRoom();
    if (!targetRoom) {
      CreepUtils.consoleLogIfWatched(this, `no room targeted for remote. sitting like a lump.`);
      return;
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

  private getTargetRoom(): string | undefined {
    let targetRoom = this.memory.targetRoom;
    if (!targetRoom) {
      // find a target room
      // TODO use room factory to get target through home room
      targetRoom = this.roomw.getRoomRemote();

      if (targetRoom) {
        // store my target room in my memory
        this.memory.targetRoom = targetRoom;
      }
    }
    return targetRoom;
  }
}
