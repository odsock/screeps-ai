import { PlannerUtils } from "planning/planner-utils";
import { RoomWrapper } from "structures/room-wrapper";

import { TowerWrapper } from "structures/tower-wrapper";
import { profile } from "../../screeps-typescript-profiler";
import { SockPuppetConstants } from "config/sockpuppet-constants";

@profile
export class TowerControl {
  private readonly plannerUtils = PlannerUtils.getInstance();
  private readonly towers: TowerWrapper[];
  private readonly colonyCenter: RoomPosition;

  public constructor(private readonly roomw: RoomWrapper) {
    this.towers = this.roomw.towers;
    this.colonyCenter = this.roomw.getColonyCenterPos();
  }

  public run(): void {
    const target = this.findAttackTarget();
    if (target) {
      this.attackHostiles(target);
      return;
    }

    const healTarget = this.findHealTarget();
    if (healTarget) {
      this.healCreeps(healTarget);
      return;
    }

    const repairTarget = this.findRepairTarget();
    if (repairTarget) {
      this.repairStructures(repairTarget);
    }
  }

  private findRepairTarget(): AnyStructure | undefined {
    return this.roomw
      .find(FIND_STRUCTURES)
      .find(
        s =>
          s.hitsMax - s.hits >= TOWER_POWER_REPAIR &&
          ((s.structureType !== STRUCTURE_WALL && s.structureType !== STRUCTURE_RAMPART) ||
            (s.structureType === STRUCTURE_WALL && s.hits < SockPuppetConstants.MAX_HITS_WALL) ||
            (s.structureType === STRUCTURE_RAMPART &&
              s.hits < SockPuppetConstants.MAX_HITS_WALL)) &&
          !this.roomw.dismantleQueueIncludes(s)
      );
  }

  /** repair structures within optimal range, and when damaged enough to avoid waste */
  private repairStructures(target: Structure): void {
    this.towers.forEach(tower => tower.repair(target));
  }

  private findHealTarget(): Creep | undefined {
    return (
      this.colonyCenter.findClosestByRange(FIND_MY_CREEPS, {
        filter: creep =>
          creep.hits < creep.hitsMax
      }) ?? undefined
    );
  }

  private healCreeps(target: Creep): void {
    this.towers.forEach(tower => tower.heal(target));
  }

  private findAttackTarget(): AnyCreep | Structure | undefined {
    const hostileCreep = this.getClosestHostileHealer();
    return hostileCreep;
  }

  private attackHostiles(target: AnyCreep | Structure): void {
    this.towers.forEach(tower => tower.attack(target));
  }

  private getClosestHostileHealer(): Creep | undefined {
    // list hostiles in close range, by number of heal parts
    const hostileCreeps = this.roomw.find(FIND_HOSTILE_CREEPS).sort((a, b) => {
      const aHealParts = a.getActiveBodyparts(HEAL);
      const bHealParts = b.getActiveBodyparts(HEAL);
      if (aHealParts === bHealParts) {
        // when equal number of heal parts sort by range to colony center
        return this.colonyCenter.getRangeTo(a.pos) < this.colonyCenter.getRangeTo(b.pos) ? 1 : -1;
      }
      return bHealParts - aHealParts;
    });
    return hostileCreeps[0];
  }
}
