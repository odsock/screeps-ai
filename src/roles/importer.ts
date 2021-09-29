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
    let cpuBefore = Game.cpu.getUsed();
    const fleeResult = this.fleeIfHostiles();
    if (fleeResult !== ERR_NOT_FOUND) {
      CreepUtils.profile(this, `flee if hostiles`, cpuBefore);
      return;
    }
    CreepUtils.profile(this, `flee if hostiles`, cpuBefore);

    cpuBefore = Game.cpu.getUsed();
    const damagedResult = this.findHealingIfDamaged();
    if (damagedResult !== ERR_FULL) {
      CreepUtils.profile(this, `find healing`, cpuBefore);
      return;
    }
    CreepUtils.profile(this, `find healing`, cpuBefore);

    cpuBefore = Game.cpu.getUsed();
    // unsign controllers we didn't sign
    if (
      this.room.controller?.sign?.username &&
      this.room.controller.sign.username !== this.owner.username &&
      this.room.controller.sign.username !== "Screeps"
    ) {
      CreepUtils.profile(this, `unsign check`, cpuBefore);
      let cpuDuring = Game.cpu.getUsed();
      let result: ScreepsReturnCode;
      if (!this.pos.isNearTo(this.room.controller)) {
        result = this.moveTo(this.room.controller, { range: 1, reusePath: 20 });
        CreepUtils.consoleLogIfWatched(this, `move result`, result);
        CreepUtils.profile(this, `unsign move`, cpuDuring);
      } else {
        cpuDuring = Game.cpu.getUsed();
        result = this.signController(this.room.controller, "");
        CreepUtils.consoleLogIfWatched(this, `sign result`, result);
        CreepUtils.profile(this, `unsign sign`, cpuDuring);
      }
      if (result === OK) {
        CreepUtils.profile(this, `unsign TOTAL`, cpuBefore);
        return;
      }
    }
    CreepUtils.profile(this, `unsign TOTAL`, cpuBefore);

    // make sure we have a target room
    const targetRoom = this.memory.targetRoom;
    if (!targetRoom) {
      CreepUtils.consoleLogIfWatched(this, `no room targeted for remote. sitting like a lump.`);
      return;
    }

    if (!this.memory.targetRoom) {
      CreepUtils.consoleLogIfWatched(this, `no room targeted. sitting like a lump.`);
      return;
    } else {
      cpuBefore = Game.cpu.getUsed();
      const harvestResult = this.doHarvestJob();
      CreepUtils.profile(this, `harvest job`, cpuBefore);
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
    const cpuBefore = Game.cpu.getUsed();
    if (this.memory.working) {
      result = this.moveToRoom(this.memory.targetRoom);
      CreepUtils.consoleLogIfWatched(this, `move to target result`, result);
      if (this.pos.roomName === this.memory.targetRoom) {
        // TODO too simple, won't pick up tomb energy in target room
        // result = this.moveToAndGet(this.findClosestActiveEnergySource());
        result = this.harvestByPriority();
      }
      CreepUtils.profile(this, `working`, cpuBefore);
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
      CreepUtils.profile(this, `not working`, cpuBefore);
    }
    return result;
  }

  private getMySource(): Source | undefined {
    let mySourceId = this.memory.source;
    if (!mySourceId) {
      mySourceId = this.findShortHandedSourceInTargetRoom();
      this.memory.source = mySourceId;
    }
    return mySourceId ? Game.getObjectById(mySourceId) ?? undefined : undefined;
  }
}
