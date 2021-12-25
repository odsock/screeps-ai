import { CreepRole } from "config/creep-types";
import { CreepUtils } from "creep-utils";
import { CreepBodyProfile } from "./creep-wrapper";
import { RemoteCreepWrapper } from "./remote-creep-wrapper";
import { profile } from "../../screeps-typescript-profiler";
import { CostMatrixUtils } from "utils/cost-matrix-utils";

declare global {
  interface CreepMemory {
    rallyRoom?: string; // room to wait in until activated by control
  }
}

@profile
export class Raider extends RemoteCreepWrapper {
  public static readonly ROLE = CreepRole.RAIDER;
  public static readonly BODY_PROFILE: CreepBodyProfile = {
    profile: [MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, RANGED_ATTACK, HEAL, HEAL, HEAL],
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
        const towers = structures.filter(s => s.structureType === STRUCTURE_TOWER);
        if (towers.length > 0) {
          target = this.pos.findClosestByPath(towers);
        } else {
          target = this.pos.findClosestByPath(structures);
        }
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
            rangedTarget =
              rangedTargetStructures.find(s => s.structureType === STRUCTURE_TOWER) ?? rangedTargetStructures[0];
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
        this.fleeArmedTowers();
        return;
      }

      this.fleeArmedTowers();
    }

    if (this.memory.rallyRoom) {
      if (this.room.name !== this.memory.rallyRoom) {
        const result = this.moveToRoom(this.memory.rallyRoom);
        CreepUtils.consoleLogIfWatched(this, `move to rally room`, result);
      } else {
        const exit = this.room.findExitTo(this.memory.targetRoom);
        if (exit !== ERR_INVALID_ARGS && exit !== ERR_NO_PATH) {
          const rallyPointPos = this.pos.findClosestByPath(exit, {
            range: 10,
            costCallback: CostMatrixUtils.creepMovementCostCallback
          });
          if (rallyPointPos) {
            const result = this.moveToW(rallyPointPos);
            CreepUtils.consoleLogIfWatched(this, `move to rally point`, result);
          }
        }
      }
    } else if (this.memory.targetRoom) {
      const result = this.moveToRoom(this.memory.targetRoom);
      CreepUtils.consoleLogIfWatched(this, `move to target room`, result);
    } else {
      CreepUtils.consoleLogIfWatched(this, `no room targeted. sitting like a lump.`);
    }
    const healCheck = this.findHealingIfDamaged();
    CreepUtils.consoleLogIfWatched(this, `find healing if damaged`, healCheck);
  }

  private fleeArmedTowers(): boolean {
    const armedTowers = this.roomw.hostileStructures.filter(
      s =>
        s.structureType === STRUCTURE_TOWER &&
        s.store.energy >= TOWER_ENERGY_COST &&
        this.pos.getRangeTo(s) < TOWER_FALLOFF_RANGE
    );
    if (armedTowers.length > 0) {
      CreepUtils.consoleLogIfWatched(this, `found ${armedTowers.length} armed towers`);
      this.room.getEventLog().filter(event => {
        if (event.event === EVENT_TRANSFER) {
          const target = Game.getObjectById(event.objectId as Id<Structure>);
          if (target?.structureType === STRUCTURE_TOWER) {
            return false;
          }
        }
      });
      const path = PathFinder.search(
        this.pos,
        armedTowers.map(t => {
          return { pos: t.pos, range: TOWER_FALLOFF_RANGE + 1 };
        }),
        { flee: true, roomCallback: CostMatrixUtils.creepMovementRoomCallback }
      ).path;
      const result = this.moveByPath(path);
      CreepUtils.consoleLogIfWatched(this, `tower avoidance`, result);
    }
    return true;
  }
}
