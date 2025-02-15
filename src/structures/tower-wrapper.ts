import { SockPuppetConstants } from "../config/sockpuppet-constants";
import { RoomWrapper } from "./room-wrapper";
import { profile } from "../../screeps-typescript-profiler";

@profile
export class TowerWrapper extends StructureTower {
  public constructor(private readonly tower: StructureTower) {
    super(tower.id);
  }

  public run(): void {
    if (this.attackHostiles() !== ERR_NOT_FOUND) {
      return;
    }

    if (this.healCreeps() !== ERR_NOT_FOUND) {
      return;
    }

    if (this.repairStructures() !== ERR_NOT_FOUND) {
      return;
    }
  }

  public get roomw(): RoomWrapper {
    return RoomWrapper.getInstance(this.room.name);
  }

  private healCreeps(): ScreepsReturnCode {
    const closestInjuredCreep = this.pos.findClosestByRange(FIND_MY_CREEPS, {
      filter: creep =>
        creep.hits < creep.hitsMax &&
        this.pos.getRangeTo(creep.pos) < SockPuppetConstants.TOWER_MAX_HEAL_RANGE
    });
    if (closestInjuredCreep) {
      return this.heal(closestInjuredCreep);
    }

    return ERR_NOT_FOUND;
  }

  private attackHostiles(): ScreepsReturnCode {
    const hostileCreep = this.getClosestHostileHealerFirst();
    if (hostileCreep) {
      return this.attack(hostileCreep);
    }
    return ERR_NOT_FOUND;
  }

  private getClosestHostileHealerFirst(): Creep | undefined {
    // list hostiles in close range, by number of heal parts
    const hostileCreeps = this.room
      .find(FIND_HOSTILE_CREEPS)
      .filter(creep => this.pos.getRangeTo(creep.pos) < SockPuppetConstants.TOWER_MAX_ATTACK_RANGE)
      .sort((a, b) => {
        const aHealParts = a.getActiveBodyparts(HEAL);
        const bHealParts = b.getActiveBodyparts(HEAL);
        if (aHealParts === bHealParts) {
          // when equal number of heal parts sort by range
          return this.pos.getRangeTo(a.pos) < this.pos.getRangeTo(b.pos) ? 1 : -1;
        }
        return aHealParts > bHealParts ? 1 : -1;
      });
    return hostileCreeps[0];
  }

  /** repair structures within optimal range, and when damaged enough to avoid waste */
  private repairStructures(): ScreepsReturnCode {
    const damagedStructureInRange = this.roomw
      .find(FIND_STRUCTURES)
      .find(
        s =>
          s.hitsMax - s.hits >= TOWER_POWER_REPAIR &&
          ((s.structureType !== STRUCTURE_WALL && s.structureType !== STRUCTURE_RAMPART) ||
            (s.structureType === STRUCTURE_WALL && s.hits < SockPuppetConstants.MAX_HITS_WALL) ||
            (s.structureType === STRUCTURE_RAMPART &&
              s.hits < SockPuppetConstants.MAX_HITS_WALL)) &&
          this.pos.inRangeTo(s.pos.x, s.pos.y, SockPuppetConstants.TOWER_MAX_REPAIR_RANGE) &&
          !this.roomw.dismantleQueueIncludes(s)
      );
    if (damagedStructureInRange) {
      return this.repair(damagedStructureInRange);
    }

    return ERR_NOT_FOUND;
  }
}
