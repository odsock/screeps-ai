import { CreepRole } from "config/creep-types";
import { CreepUtils } from "creep-utils";
import { profile } from "../../screeps-typescript-profiler";
import { CreepBodyProfile } from "./creep-wrapper";
import { RemoteCreepWrapper } from "./remote-creep-wrapper";

@profile
export class Claimer extends RemoteCreepWrapper {
  public static readonly ROLE = CreepRole.CLAIMER;
  public static readonly BODY_PROFILE: CreepBodyProfile = {
    profile: [MOVE, CLAIM],
    seed: [],
    maxBodyParts: 4
  };

  public run(): void {
    CreepUtils.consoleLogIfWatched(this, `running ${this.name}`);

    const fleeResult = this.fleeIfHostiles();
    if (fleeResult !== ERR_NOT_FOUND) {
      return;
    }

    const damagedResult = this.findHealingIfDamaged();
    if (damagedResult !== ERR_FULL) {
      return;
    }

    // unsign controllers we didn't sign
    if (this.room.controller?.sign?.username && this.room.controller.sign.username !== this.owner.username) {
      this.moveToW(this.room.controller);
      this.signController(this.room.controller, "");
    }

    // make sure we have a target room
    if (!this.memory.targetRoom) {
      CreepUtils.consoleLogIfWatched(this, `no room targeted for claiming. sitting like a lump.`);
      return;
    }
    CreepUtils.consoleLogIfWatched(this, `target room ${this.memory.targetRoom}`);

    // go to the room if not in it
    if (this.pos.roomName !== this.memory.targetRoom) {
      const result = this.moveToRoom(this.memory.targetRoom);
      CreepUtils.consoleLogIfWatched(this, `move to target room ${this.memory.targetRoom}`, result);
      return;
    }

    if (!this.roomw.controller) {
      return;
    }

    if (
      (this.roomw.controller.owner && !this.roomw.controller.my) ||
      (this.roomw.controller.reservation && this.roomw.controller.reservation.username !== this.owner.username)
    ) {
      this.moveToAndAttackController();
      return;
    }

    // go to controller and claim or reserve it
    const claimFlag = this.targetControl.targetRooms.includes(this.memory.targetRoom);
    CreepUtils.consoleLogIfWatched(this, `claim target room? ${String(claimFlag)}`);
    if (claimFlag) {
      const result = this.claimTargetRoom();
      CreepUtils.consoleLogIfWatched(this, `claim controller: ${String(this.roomw.controller)}`, result);
    } else {
      const reserveResult = this.reserveTargetRoom();
      CreepUtils.consoleLogIfWatched(this, `reserve controller: ${String(this.roomw.controller)}`, reserveResult);
    }
    return;
  }

  private moveToAndAttackController(): ScreepsReturnCode {
    if (!this.roomw.controller) {
      CreepUtils.consoleLogIfWatched(this, `no controller to attack: ${String(this.roomw.name)}`);
      return ERR_INVALID_TARGET;
    }

    if (!this.pos.isNearTo(this.roomw.controller)) {
      const moveResult = this.moveToW(this.roomw.controller);
      CreepUtils.consoleLogIfWatched(this, `move to controller: ${String(this.roomw.controller)}`, moveResult);
      return moveResult;
    } else {
      const attackResult = this.attackController(this.roomw.controller);
      CreepUtils.consoleLogIfWatched(this, `attack controller: ${String(this.roomw.controller)}`, attackResult);
      return attackResult;
    }
  }
}
