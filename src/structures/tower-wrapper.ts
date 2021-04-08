import { CreepUtils } from "creep-utils";

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
    const closestHostile = this.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
    if (closestHostile) {
      return this.attack(closestHostile);
    }
    return ERR_NOT_FOUND;
  }

  private repairStructures(): ScreepsReturnCode {
    // first repair non-roads
    const closestDamagedStructure = this.findClosestDamagedNonRoad();
    if (closestDamagedStructure) {
      return this.repair(closestDamagedStructure);
    }

    // second repair roads
    const closestDamagedRoad = this.findClosestDamagedRoad();
    if (closestDamagedRoad) {
      return this.repair(closestDamagedRoad);
    }

    return ERR_NOT_FOUND;
  }

  private findClosestDamagedNonRoad(): AnyStructure | null {
    return this.pos.findClosestByRange(FIND_STRUCTURES, {
      filter: structure => structure.hits < structure.hitsMax && structure.structureType !== STRUCTURE_ROAD
    });
  }

  private findClosestDamagedRoad(): StructureRoad | null {
    return this.pos.findClosestByRange<StructureRoad>(FIND_STRUCTURES, {
      filter: structure => structure.hits < structure.hitsMax && structure.structureType === STRUCTURE_ROAD
    });
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
