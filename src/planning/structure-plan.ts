export class StructurePlan {
  private readonly terrain: RoomTerrain;
  private _plan: StructurePlanPosition[] = [];
  private planned: boolean = false;
  private readonly pattern: StructurePatternPosition[];

  constructor(pattern: StructurePatternPosition[], private readonly room: Room) {
    this.terrain = room.getTerrain();
    this.pattern = pattern;
  }

  get plan(): StructurePlanPosition[] | null {
    return this.planned ? this._plan : null;
  }

  public getWidth(): number {
    return this.pattern.reduce<number>((max, pos) => { return max > pos.xOffset ? max : pos.xOffset }, 0);
  }

  public getHeight(): number {
    return this.pattern.reduce<number>((max, pos) => { return max > pos.yOffset ? max : pos.yOffset }, 0);
  }

  public translate(x: number, y: number): boolean {
    let planOkSoFar = true;
    for (let i = 0; i < this.pattern.length; i++) {
      const planPosition = this.pattern[i];
      const newPos = this.room.getPositionAt(this.pattern[i].xOffset + x, this.pattern[i].yOffset + y);
      if (!newPos || !this.translatePosition(planPosition, newPos)) {
        planOkSoFar = false;
      }
    }
    this.planned = planOkSoFar;
    return this.planned;
  }

  private translatePosition(planPosition: StructurePatternPosition, pos: RoomPosition): boolean {
    // can be blocked by wall, deposit, source
    if (this.terrain.get(pos.x, pos.y) == TERRAIN_MASK_WALL) {
      return false;
    }
    if (this.room.lookForAt(LOOK_DEPOSITS, pos).length > 0) {
      return false;
    }
    if (this.room.lookForAt(LOOK_SOURCES, pos).length > 0) {
      return false;
    }
    // can be blocked by non-road structure or construction site
    const posStructures = this.room.lookForAt(LOOK_STRUCTURES, pos);
    if (posStructures.filter((s) => s.structureType != STRUCTURE_ROAD).length > 0) {
      return false;
    }
    const posConstSites = this.room.lookForAt(LOOK_CONSTRUCTION_SITES, pos);
    if (posConstSites.filter((s) => s.structureType != STRUCTURE_ROAD)) {
      return false;
    }

    // road overlap is ok, but don't place new construction site
    if (planPosition.structure == STRUCTURE_ROAD && posStructures.filter((s) => s.structureType == STRUCTURE_ROAD).length > 0) {
      return true;
    }
    if (planPosition.structure == STRUCTURE_ROAD && posConstSites.filter((s) => s.structureType == STRUCTURE_ROAD).length > 0) {
      return true;
    }

    this._plan.push({ structure: planPosition.structure, pos: pos });
    return true;
  }
}
