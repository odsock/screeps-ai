export class StructurePlan {
  private _plan: RoomPosition[] | undefined;
  private readonly terrain: RoomTerrain;

  constructor(private readonly pattern: StructurePlanPosition[], private readonly room: Room) {
    this.terrain = room.getTerrain();
  }

  get plan(): RoomPosition[] | undefined {
    return this._plan;
  }

  public getWidth(): number {
    return this.pattern.reduce<number>((max, pos) => { return max > pos.xOffset ? max : pos.xOffset }, 0);
  }

  public getHeight(): number {
    return this.pattern.reduce<number>((max, pos) => { return max > pos.yOffset ? max : pos.yOffset }, 0);
  }

  public getStructureAt(pos: RoomPosition): StructureConstant | null {
    if (this._plan && this._plan.length > 0) {
      return this.pattern[this._plan.indexOf(pos)].structure;
    }
    return null;
  }

  public translate(x: number, y: number): boolean {
    let tempPlan = [];
    for (let i = 0; i < this.pattern.length; i++) {
      const newPos = this.room.getPositionAt(this.pattern[i].xOffset + x, this.pattern[i].yOffset + y);
      if (newPos && !this.isPositionBlocked(newPos, this.pattern[i].structure)) {
        tempPlan.push(newPos);
      }
      else {
        return false;
      }
    }
    this._plan = tempPlan;
    return true;
  }

  private isPositionBlocked(pos: RoomPosition, plannedStructure: StructureConstant | null): boolean {
    if (this.terrain.get(pos.x, pos.y) == TERRAIN_MASK_WALL) {
      return true;
    }
    else {
      const posContents = this.room.lookAt(pos);
      return posContents.reduce<boolean>((blocked, item) => {
        const blockedRoad = plannedStructure == STRUCTURE_ROAD &&
          item.type == LOOK_STRUCTURES &&
          (item.constructionSite?.structureType != STRUCTURE_ROAD ||
            item.structure?.structureType != STRUCTURE_ROAD);
        // if (blockedRoad) {
        //   console.log(`plan: blocked road: at ${pos.x},${pos.y}`);
        //   console.log(item);
        // }
        const blockedStructure = plannedStructure != STRUCTURE_ROAD &&
          (item.type == LOOK_CONSTRUCTION_SITES ||
            item.type == LOOK_DEPOSITS ||
            item.type == LOOK_SOURCES ||
            item.type == LOOK_STRUCTURES);
        // if (blockedStructure) {
        //   console.log(`plan: blocked structure at ${pos.x},${pos.y}`);
        //   console.log(item);
        // }
        return blocked || blockedRoad || blockedStructure;
      }, false);
    }
  }
}
