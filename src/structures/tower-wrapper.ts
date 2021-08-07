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
    // repair structures
    const closestDamagedStructure = this.findClosestDamagedNonRoad();
    if (closestDamagedStructure) {
      return this.repair(closestDamagedStructure);
    }

    // repair roads
    const closestDamagedRoad = this.findClosestDamagedRoad();
    if (closestDamagedRoad) {
      return this.repair(closestDamagedRoad);
    }

    // repair walls
    const weakestWall = this.findWeakestWall();
    if (weakestWall) {
      return this.repair(weakestWall);
    }

    return ERR_NOT_FOUND;
  }

  private findClosestDamagedNonRoad(): AnyStructure | null {
    return this.pos.findClosestByRange(FIND_STRUCTURES, {
      filter: structure =>
        structure.hits < structure.hitsMax &&
        structure.structureType !== STRUCTURE_ROAD &&
        structure.structureType !== STRUCTURE_WALL
    });
  }

  private findClosestDamagedRoad(): StructureRoad | null {
    return this.pos.findClosestByRange<StructureRoad>(FIND_STRUCTURES, {
      filter: structure => structure.hits < structure.hitsMax && structure.structureType === STRUCTURE_ROAD
    });
  }

  private findWeakestWall(): StructureWall | null {
    const MAX_HITS_WALL = 10000000;
    const wallsToRepair = this.room.find<StructureWall>(FIND_STRUCTURES, {
      filter: structure => structure.hits < MAX_HITS_WALL && structure.structureType === STRUCTURE_WALL
    });

    if (wallsToRepair.length > 0) {
      return wallsToRepair.reduce((weakestWall, wall) => {
        return weakestWall.hits < wall.hits ? weakestWall : wall;
      });
    } else {
      return null;
    }
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
