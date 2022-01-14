import { CreepRole } from "config/creep-types";
import { SockPuppetConstants } from "config/sockpuppet-constants";
import { CreepUtils } from "creep-utils";
import { profile } from "../../screeps-typescript-profiler";
import { CreepBodyProfile } from "./creep-wrapper";
import { RemoteCreepWrapper } from "./remote-creep-wrapper";

declare global {
  interface CreepMemory {
    rallyRoom?: string; // room to wait in until activated by control
    avoidTowers?: boolean;
    controlFlag?: string; // flag with coordinating memory values
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
  private controlFlag: Flag | undefined;
  private rallyRoom: string | undefined;
  private tactic: string | undefined;

  public run(): void {
    if (this.memory.controlFlag) {
      this.controlFlag = Game.flags[this.memory.controlFlag] ?? undefined;
      if (this.controlFlag) {
        this.rallyRoom = this.controlFlag.memory.rallyRoom;
        this.tactic = this.controlFlag.memory.tactic;
      }
    }

    if (this.hits < this.hitsMax) {
      const result = this.heal(this);
      CreepUtils.consoleLogIfWatched(this, `heal self`, result);
    }

    if (this.tactic === "feint" && this.rallyRoom) {
      CreepUtils.consoleLogIfWatched(this, `tactic: ${this.tactic}`);
      if (this.room.name === this.memory.targetRoom) {
        const result = this.moveToRoom(this.rallyRoom);
        CreepUtils.consoleLogIfWatched(this, `returning to rally room`, result);
      } else {
        const result = this.moveToRoom(this.memory.targetRoom);
        CreepUtils.consoleLogIfWatched(this, `move to target room`, result);
      }
      this.attackAdjacent();
      this.doRangedAttack();
      return;
    } else if (this.tactic === "charge") {
      CreepUtils.consoleLogIfWatched(this, `tactic: ${this.tactic}`);
      if (this.room.name !== this.memory.targetRoom) {
        const result = this.moveToRoom(this.memory.targetRoom);
        CreepUtils.consoleLogIfWatched(this, `move to target room`, result);
      }

      // TODO create structure attack priority

      if (this.roomw.hasHostiles) {
        const creeps = this.roomw.hostileCreeps;
        const attackCreeps = creeps.filter(c =>
          c.body.some(part => part.type === ATTACK || part.type === RANGED_ATTACK)
        );
        const structures = this.roomw.hostileStructures;
        let target: Creep | AnyOwnedStructure | null | undefined;
        if (attackCreeps.length) {
          target = this.pos.findClosestByPath(attackCreeps);
        } else if (structures.length > 0) {
          const towers = structures.filter(s => s.structureType === STRUCTURE_TOWER);
          if (towers.length > 0) {
            target = this.pos.findClosestByPath(towers);
          }
        } else if (creeps.length > 0) {
          target = this.pos.findClosestByPath(creeps);
        } else {
          target = this.pos.findClosestByPath(structures);
        }

        this.doRangedAttack(target);

        if (target) {
          const attackResult = this.moveToAndAttack(target);
          CreepUtils.consoleLogIfWatched(this, `attack`, attackResult);
          return;
        }
      }
      return;
    }

    if (this.memory.rallyRoom) {
      if (this.room.name !== this.memory.rallyRoom) {
        const result = this.moveToRoom(this.memory.rallyRoom);
        CreepUtils.consoleLogIfWatched(this, `move to rally room`, result);
      } else {
        const result = this.moveToW(new RoomPosition(25, 25, this.room.name), { range: 10 });
        CreepUtils.consoleLogIfWatched(this, `move to rally point`, result);
      }
    } else {
      CreepUtils.consoleLogIfWatched(this, `no room targeted. sitting like a lump.`);
    }
    const healCheck = this.findHealingIfDamaged();
    CreepUtils.consoleLogIfWatched(this, `find healing if damaged`, healCheck);
  }

  private attackAdjacent(): void {
    const hostileCreeps = this.roomw
      .lookForAtArea(
        LOOK_CREEPS,
        Math.max(0, this.pos.y - 1),
        Math.max(0, this.pos.x - 1),
        Math.min(SockPuppetConstants.ROOM_SIZE, this.pos.y + 1),
        Math.min(SockPuppetConstants.ROOM_SIZE, this.pos.x + 1),
        true
      )
      .filter(l => !l.creep.my)
      .sort((a, b) => this.calcCreepAttackPriority(a) - this.calcCreepAttackPriority(b))
      .map(c => c.creep);
    if (hostileCreeps.length > 0) {
      const result = this.attack(hostileCreeps[0]);
      CreepUtils.consoleLogIfWatched(this, `attack adjacent`, result);
    }
  }

  private calcCreepAttackPriority(a: LookForAtAreaResultWithPos<Creep, "creep">): number {
    return (
      a.creep.getActiveBodyparts(HEAL) * 2 +
      a.creep.getActiveBodyparts(ATTACK) +
      a.creep.getActiveBodyparts(RANGED_ATTACK)
    );
  }

  private doRangedAttack(target?: Creep | AnyOwnedStructure | null | undefined) {
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
  }

  private fleeArmedTowers(): boolean {
    if (this.memory.avoidTowers === undefined) {
      this.memory.avoidTowers = true;
    }
    if (!this.memory.avoidTowers) {
      CreepUtils.consoleLogIfWatched(this, `not avoiding towers`);
      return false;
    }
    const armedTowers = this.roomw.hostileStructures.filter(
      s =>
        s.structureType === STRUCTURE_TOWER &&
        s.store.energy >= TOWER_ENERGY_COST &&
        this.pos.getRangeTo(s) < TOWER_FALLOFF_RANGE
    );
    if (armedTowers.length > 0) {
      CreepUtils.consoleLogIfWatched(this, `found ${armedTowers.length} armed towers`);
      if (
        this.room.getEventLog().find(event => {
          if (event.event === EVENT_TRANSFER) {
            const target = Game.getObjectById(event.objectId as Id<Structure>);
            if (target?.structureType === STRUCTURE_TOWER) {
              CreepUtils.consoleLogIfWatched(this, `enemy tower resupplied`);
              return true;
            }
          }
          return false;
        })
      ) {
        return false;
      }
      const path = PathFinder.search(
        this.pos,
        armedTowers.map(t => {
          return { pos: t.pos, range: TOWER_FALLOFF_RANGE + 1 };
        }),
        { flee: true, roomCallback: this.costMatrixUtils.creepMovementRoomCallback }
      ).path;
      const result = this.moveByPath(path);
      CreepUtils.consoleLogIfWatched(this, `tower avoidance`, result);
    }
    return true;
  }
}
