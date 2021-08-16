import { Constants } from "../constants";
import { CreepUtils } from "creep-utils";
import { RoomWrapper } from "./room-wrapper";

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
    return new RoomWrapper(this.room);
  }

  private healCreeps(): ScreepsReturnCode {
    const closestInjuredCreep = this.pos.findClosestByRange(FIND_MY_CREEPS, {
      filter: creep => creep.hits < creep.hitsMax
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
      .filter(creep => this.pos.getRangeTo(creep.pos) < Constants.TOWER_MAX_ATTACK_RANGE)
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

  // try to repair structures within optimal range only, and only when damaged enough to use full energy
  private repairStructures(): ScreepsReturnCode {
    // repair structures
    const structure = this.roomw.findClosestDamagedNonRoad(this.pos);
    if (
      structure &&
      structure.hitsMax - structure.hits > TOWER_POWER_REPAIR &&
      this.pos.inRangeTo(structure.pos.x, structure.pos.y, Constants.TOWER_MAX_REPAIR_RANGE)
    ) {
      return this.repair(structure);
    }

    // repair roads
    const road = this.roomw.findClosestDamagedRoad(this.pos);
    if (
      road &&
      road.hitsMax - road.hits > TOWER_POWER_REPAIR &&
      this.pos.inRangeTo(road.pos.x, road.pos.y, Constants.TOWER_MAX_REPAIR_RANGE)
    ) {
      return this.repair(road);
    }

    // repair walls
    const wall = this.roomw.findWeakestWall();
    if (
      wall &&
      wall.hitsMax - wall.hits > TOWER_POWER_REPAIR &&
      this.pos.inRangeTo(wall.pos.x, wall.pos.y, Constants.TOWER_MAX_REPAIR_RANGE)
    ) {
      return this.repair(wall);
    }

    return ERR_NOT_FOUND;
  }

  // unused for now
  // new road construction is triggered when unused road to extension decays, which triggers a builder spawn
  // seems better to just repair them (or not make dumb roads!)
  private findClosestDamagedUsedRoad(): StructureRoad | null {
    return this.pos.findClosestByRange<StructureRoad>(FIND_STRUCTURES, {
      filter: structure => {
        if (!(structure.structureType === STRUCTURE_ROAD)) {
          return false;
        }
        const isDamagedRoad = structure.hits < structure.hitsMax;
        const isUsedRoad = this.room.memory.roadUseLog[`${structure.pos.x},${structure.pos.y}`] > 0;
        if (!isUsedRoad && isDamagedRoad) {
          CreepUtils.consoleLogIfWatched(this.room, `not repairing unused road: ${structure.pos.x},${structure.pos.y}`);
        }
        return isDamagedRoad && isUsedRoad;
      }
    });
  }
}
