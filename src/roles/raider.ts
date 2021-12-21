import { CreepRole } from "config/creep-types";
import { CreepUtils } from "creep-utils";
import { CreepBodyProfile } from "./creep-wrapper";
import { RemoteCreepWrapper } from "./remote-creep-wrapper";
import { profile } from "../../screeps-typescript-profiler";
import { CostMatrixUtils } from "utils/cost-matrix-utils";

@profile
export class Raider extends RemoteCreepWrapper {
  public static readonly ROLE = CreepRole.RAIDER;
  public static readonly BODY_PROFILE: CreepBodyProfile = {
    profile: [MOVE, MOVE, MOVE, MOVE, MOVE, TOUGH, ATTACK, RANGED_ATTACK, HEAL, HEAL],
    seed: [],
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

      let rangedTarget: Creep | AnyOwnedStructure | undefined;
      if (target && this.pos.inRangeTo(target, 3)) {
        rangedTarget = target;
      } else {
        const rangedTargetCreeps = this.pos.findInRange(FIND_HOSTILE_CREEPS, 3);
        if (rangedTargetCreeps.length > 0) {
          rangedTarget = rangedTargetCreeps[0];
        } else {
          const rangedTargetStructures = this.pos.findInRange(FIND_HOSTILE_STRUCTURES, 3);
          if (rangedTargetStructures.length > 0) {
            rangedTarget = rangedTargetStructures[0];
          }
        }
      }

      if (rangedTarget) {
        const rangedAttackResult = this.rangedAttack(rangedTarget);
        CreepUtils.consoleLogIfWatched(this, `ranged attack`, rangedAttackResult);
      }

      if (target) {
        const attackResult = this.moveToAndAttack(target);
        CreepUtils.consoleLogIfWatched(this, `attack`, attackResult);
        return;
      }

      const armedTowers = this.roomw.hostileStructures.filter(
        s =>
          s.structureType === STRUCTURE_TOWER &&
          s.store.energy >= TOWER_ENERGY_COST &&
          this.pos.getRangeTo(s) < TOWER_FALLOFF_RANGE
      );
      if (armedTowers.length > 0) {
        this.moveByPath(
          PathFinder.search(
            this.pos,
            armedTowers.map(t => {
              return { pos: t.pos, range: TOWER_FALLOFF_RANGE + 1 };
            }),
            { flee: true, roomCallback: CostMatrixUtils.creepMovementRoomCallback }
          ).path
        );
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
