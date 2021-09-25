import { CreepRole } from "config/creep-types";
import { TargetConfig } from "config/target-config";
import { CreepUtils } from "creep-utils";
import { CreepBodyProfile } from "./creep-wrapper";
import { RemoteWorker } from "./remote-worker";

export class Importer extends RemoteWorker {
  public static readonly ROLE = CreepRole.IMPORTER;
  public static readonly BODY_PROFILE: CreepBodyProfile = {
    profile: [WORK, CARRY, MOVE, MOVE],
    seed: [],
    maxBodyParts: MAX_CREEP_SIZE
  };

  public run(): void {
    let cpuBefore = Game.cpu.getUsed();
    // unsign controllers we didn't sign
    if (this.room.controller?.sign?.username && this.room.controller.sign.username !== this.owner.username) {
      CreepUtils.consoleLogIfWatched(this, `cpu unsign check ${Game.cpu.getUsed() - cpuBefore}`);
      let cpuDuring = Game.cpu.getUsed();
      const moveResult = this.moveTo(this.room.controller, { reusePath: 20 });
      CreepUtils.consoleLogIfWatched(this, `cpu unsign move ${Game.cpu.getUsed() - cpuDuring}`);
      cpuDuring = Game.cpu.getUsed();
      const inRange = this.pos.isNearTo(this.room.controller);
      CreepUtils.consoleLogIfWatched(this, `cpu unsign in range ${String(inRange)}`);
      if (inRange) {
        CreepUtils.consoleLogIfWatched(this, `cpu unsign range check ${Game.cpu.getUsed() - cpuDuring}`);
        cpuDuring = Game.cpu.getUsed();
        this.signController(this.room.controller, "");
        CreepUtils.consoleLogIfWatched(this, `cpu unsign sign ${Game.cpu.getUsed() - cpuDuring}`);
      }
      if (moveResult === OK) {
        CreepUtils.consoleLogIfWatched(this, `cpu unsign ${Game.cpu.getUsed() - cpuBefore}`);
        return;
      }
    }
    CreepUtils.consoleLogIfWatched(this, `cpu unsign ${Game.cpu.getUsed() - cpuBefore}`);

    // use current room for home (room spawned in)
    if (!this.homeRoom) {
      this.homeRoom = this.pos.roomName;
    }

    cpuBefore = Game.cpu.getUsed();
    const result = this.fleeIfHostiles();
    if (result !== ERR_NOT_FOUND) {
      return;
    }
    CreepUtils.consoleLogIfWatched(this, `cpu flee if hostiles ${Game.cpu.getUsed() - cpuBefore}`);

    cpuBefore = Game.cpu.getUsed();
    const damagedResult = this.findHealingIfDamaged();
    if (damagedResult !== ERR_FULL) {
      return;
    }
    CreepUtils.consoleLogIfWatched(this, `cpu find healing ${Game.cpu.getUsed() - cpuBefore}`);

    // make sure we have a target room
    const targetRoom = this.memory.targetRoom;
    if (!targetRoom) {
      CreepUtils.consoleLogIfWatched(this, `no room targeted for remote. sitting like a lump.`);
      return;
    }

    const claimFlag = TargetConfig.TARGETS[Game.shard.name].includes(targetRoom);
    CreepUtils.consoleLogIfWatched(this, `room ${this.room.name} planned for claim? ${String(claimFlag)}`);

    if (!this.targetRoom) {
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

    if (!this.targetRoom || !this.homeRoom) {
      CreepUtils.consoleLogIfWatched(this, `missing room configuration. sitting like a lump.`);
      return ERR_INVALID_ARGS;
    }

    let result: ScreepsReturnCode = OK;
    if (this.memory.working) {
      const cpuBefore = Game.cpu.getUsed();
      result = this.moveToRoom(this.targetRoom);
      CreepUtils.consoleLogIfWatched(this, `move to target result`, result);
      if (this.pos.roomName === this.targetRoom) {
        result = this.harvestByPriority();
      }
      CreepUtils.consoleLogIfWatched(this, `cpu working ${Game.cpu.getUsed() - cpuBefore}`);
      return result;
    } else {
      const cpuBefore = Game.cpu.getUsed();
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
      CreepUtils.consoleLogIfWatched(this, `cpu not working ${Game.cpu.getUsed() - cpuBefore}`);
    }
    return result;
  }
}
