import { CreepRole } from "config/creep-types";
import { CreepUtils } from "creep-utils";
import { CreepBodyProfile } from "./creep-wrapper";
import { RemoteWorker } from "./remote-worker";

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
      CreepUtils.consoleLogIfWatched(this, `cpu flee if hostiles ${Game.cpu.getUsed() - cpuBefore}`);
      return;
    }
    CreepUtils.consoleLogIfWatched(this, `cpu flee if hostiles ${Game.cpu.getUsed() - cpuBefore}`);

    cpuBefore = Game.cpu.getUsed();
    const damagedResult = this.findHealingIfDamaged();
    if (damagedResult !== ERR_FULL) {
      CreepUtils.consoleLogIfWatched(this, `cpu find healing ${Game.cpu.getUsed() - cpuBefore}`);
      return;
    }
    CreepUtils.consoleLogIfWatched(this, `cpu find healing ${Game.cpu.getUsed() - cpuBefore}`);

    cpuBefore = Game.cpu.getUsed();
    // unsign controllers we didn't sign
    if (
      this.room.controller?.sign?.username &&
      this.room.controller.sign.username !== this.owner.username &&
      this.room.controller.sign.username !== "Screeps"
    ) {
      CreepUtils.consoleLogIfWatched(this, `cpu unsign check ${Game.cpu.getUsed() - cpuBefore}`);
      let cpuDuring = Game.cpu.getUsed();
      let result: ScreepsReturnCode;
      if (!this.pos.isNearTo(this.room.controller)) {
        result = this.moveTo(this.room.controller, { range: 1, reusePath: 20 });
        CreepUtils.consoleLogIfWatched(this, `move result`, result);
        CreepUtils.consoleLogIfWatched(this, `cpu unsign move ${Game.cpu.getUsed() - cpuDuring}`);
      } else {
        cpuDuring = Game.cpu.getUsed();
        CreepUtils.consoleLogIfWatched(this, `cpu unsign range check ${Game.cpu.getUsed() - cpuDuring}`);
        cpuDuring = Game.cpu.getUsed();
        result = this.signController(this.room.controller, "");
        CreepUtils.consoleLogIfWatched(this, `sign result`, result);
        CreepUtils.consoleLogIfWatched(this, `cpu unsign sign ${Game.cpu.getUsed() - cpuDuring}`);
      }
      if (result === OK) {
        CreepUtils.consoleLogIfWatched(this, `cpu unsign ${Game.cpu.getUsed() - cpuBefore}`);
        return;
      }
    }
    CreepUtils.consoleLogIfWatched(this, `cpu unsign ${Game.cpu.getUsed() - cpuBefore}`);

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
      CreepUtils.consoleLogIfWatched(this, `cpu harvest job ${Game.cpu.getUsed() - cpuBefore}`);
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
      const cpuBefore = Game.cpu.getUsed();
      result = this.moveToRoom(this.memory.targetRoom);
      CreepUtils.consoleLogIfWatched(this, `move to target result`, result);
      if (this.pos.roomName === this.memory.targetRoom) {
        result = this.moveToAndGet(this.findClosestActiveEnergySource());
      }
      CreepUtils.consoleLogIfWatched(this, `cpu working ${Game.cpu.getUsed() - cpuBefore}`);
      return result;
    } else {
      const cpuBefore = Game.cpu.getUsed();
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
      CreepUtils.consoleLogIfWatched(this, `cpu not working ${Game.cpu.getUsed() - cpuBefore}`);
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
