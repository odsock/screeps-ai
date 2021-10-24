import { CreepRole } from "config/creep-types";
import { CreepUtils } from "creep-utils";
import { CreepBodyProfile } from "./creep-wrapper";
import { RemoteWorker } from "./remote-worker";
import { profile } from "../../screeps-typescript-profiler";

@profile
export class Guard extends RemoteWorker {
  public static readonly ROLE = CreepRole.GUARD;
  public static readonly BODY_PROFILE: CreepBodyProfile = {
    profile: [TOUGH, MOVE, MOVE, ATTACK],
    seed: [TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, ATTACK],
    maxBodyParts: MAX_CREEP_SIZE
  };

  public run(): void {
    if (this.roomw.hasHostiles) {
      const creeps = this.roomw.hostileCreeps;
      const structures = this.roomw.hostileStructures;
      let target: Creep | AnyOwnedStructure | null;
      if (creeps.length) {
        target = this.pos.findClosestByPath(creeps);
      } else {
        target = this.pos.findClosestByPath(structures);
      }
      if (target) {
        const attackResult = this.moveToAndAttack(target);
        CreepUtils.consoleLogIfWatched(this, `attack`, attackResult);
        return;
      }
    }

    if (!this.memory.targetRoom) {
      CreepUtils.consoleLogIfWatched(this, `no room targeted. sitting like a lump.`);
      return;
    } else {
      const result = this.moveToRoom(this.memory.targetRoom);
      CreepUtils.consoleLogIfWatched(this, `move to target room`, result);
      const healCheck = this.findHealingIfDamaged();
      CreepUtils.consoleLogIfWatched(this, `find healing if damaged`, healCheck);
    }
  }
}
