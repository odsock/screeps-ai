import { CreepUtils } from "creep-utils";

export class TowerWrapper extends StructureTower {
  public constructor(private readonly tower: StructureTower) {
    super(tower.id);
  }

  public run(): void {
    const closestHostile = this.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
    if (closestHostile) {
      this.attack(closestHostile);
    } else {
      const closestDamagedStructure = this.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: structure => structure.hits < structure.hitsMax && structure.structureType !== STRUCTURE_ROAD
      });

      if (closestDamagedStructure) {
        this.repair(closestDamagedStructure);
      } else {
        const closestDamagedRoad = this.pos.findClosestByRange(FIND_STRUCTURES, {
          filter: structure => {
            if (!(structure.structureType === STRUCTURE_ROAD)) {
              return false;
            }
            const isDamagedRoad = structure.hits < structure.hitsMax;
            const isUsedRoad = this.room.memory.roadUseLog[`${structure.pos.x},${structure.pos.y}`] > 0;
            if (!isUsedRoad && isDamagedRoad) {
              CreepUtils.consoleLogIfWatched(
                this.room,
                `not repairing unused road: ${structure.pos.x},${structure.pos.y}`
              );
            }
            return isDamagedRoad && isUsedRoad;
          }
        });

        if (closestDamagedRoad) {
          this.repair(closestDamagedRoad);
        }
      }
    }
  }
}
