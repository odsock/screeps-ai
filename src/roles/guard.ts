import { CreepRole } from "config/creep-types";
import { CreepUtils } from "creep-utils";
import { CreepBodyProfile } from "./creep-body-utils";
import { RemoteCreepWrapper } from "./remote-creep-wrapper";
import { profile } from "../../screeps-typescript-profiler";

@profile
export class Guard extends RemoteCreepWrapper {
  public static readonly ROLE = CreepRole.GUARD;
  public static readonly BODY_PROFILE: CreepBodyProfile = {
    profile: [TOUGH, MOVE, MOVE, ATTACK],
    seed: [MOVE, MOVE, MOVE, MOVE, ATTACK, HEAL, HEAL, HEAL],
    maxBodyParts: MAX_CREEP_SIZE
  };
  public static readonly BODY_PROFILE_SMALL: CreepBodyProfile = {
    profile: [MOVE, ATTACK],
    seed: [MOVE, MOVE, ATTACK, HEAL],
    maxBodyParts: MAX_CREEP_SIZE
  };

  public run(): void {
    if (this.hits < this.hitsMax) {
      const result = this.heal(this);
      CreepUtils.consoleLogIfWatched(this, `heal self`, result);
    }

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
    } else {
      const result = this.moveToRoom(this.memory.targetRoom);
      CreepUtils.consoleLogIfWatched(this, `move to target room`, result);
      const healCheck = this.findHealingIfDamaged();
      CreepUtils.consoleLogIfWatched(this, `find healing if damaged`, healCheck);
      return;
    }

    const result = this.moveOffTheRoad();
    CreepUtils.consoleLogIfWatched(this, `move off the road`, result);
  }
}
