import { StructurePatterns } from "structure-patterns";

export class StructurePlan {
  private readonly terrain: RoomTerrain;
  // private plan: StructurePlanPosition[] = [];
  private planned = false;
  private readonly pattern: StructurePatternPosition[];
  private plan: StructurePlanPosition[] = [];

  public constructor(pattern: StructurePatternPosition[], private readonly room: Room) {
    this.terrain = room.getTerrain();
    this.pattern = pattern;
    this.printPattern();
  }
  public printPattern(): void {
    for (const i of this.pattern) {
      console.log(`${i.xOffset}, ${i.yOffset}, ${i.structure}`);
    }
  }

  public static buildStructurePlan(pattern: string[], room: Room): StructurePlan {
    const structurePattern: StructurePatternPosition[] = [];
    for (let i = 0; i < pattern.length; i++) {
      for (let j = 0; j < pattern[i]?.length; j++) {
        const structureConstant = StructurePatterns.CHARACTERS[pattern[i].charAt(j)];
        if (structureConstant) {
          structurePattern.push({ xOffset: j, yOffset: i, structure: structureConstant });
        }
      }
    }
    return new StructurePlan(structurePattern, room);
  }

  public getPlan(): StructurePlanPosition[] | null {
    return this.planned ? this.plan : null;
  }

  public getWidth(): number {
    return this.pattern.reduce<number>((max, pos) => {
      return max > pos.xOffset ? max : pos.xOffset;
    }, 0);
  }

  public getHeight(): number {
    return this.pattern.reduce<number>((max, pos) => {
      return max > pos.yOffset ? max : pos.yOffset;
    }, 0);
  }

  public translate(x: number, y: number): boolean {
    this.planned = false;
    this.plan = [];
    let planOkSoFar = true;
    for (const planPosition of this.pattern) {
      const newPos = this.room.getPositionAt(planPosition.xOffset + x, planPosition.yOffset + y);
      if (!newPos || !this.translatePosition(planPosition, newPos)) {
        planOkSoFar = false;
      }
    }
    this.planned = planOkSoFar;
    return this.planned;
  }

  private translatePosition(planPosition: StructurePatternPosition, pos: RoomPosition): boolean {
    // can be blocked by wall, deposit, source
    if (this.terrain.get(pos.x, pos.y) === TERRAIN_MASK_WALL) {
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
    if (posStructures.filter(s => s.structureType !== STRUCTURE_ROAD).length > 0) {
      return false;
    }
    const posConstSites = this.room.lookForAt(LOOK_CONSTRUCTION_SITES, pos);
    if (posConstSites.filter(s => s.structureType !== STRUCTURE_ROAD).length > 0) {
      return false;
    }

    // road overlap is ok, but don't place new construction site
    if (
      planPosition.structure === STRUCTURE_ROAD &&
      posStructures.filter(s => s.structureType === STRUCTURE_ROAD).length > 0
    ) {
      return true;
    }
    if (
      planPosition.structure === STRUCTURE_ROAD &&
      posConstSites.filter(s => s.structureType === STRUCTURE_ROAD).length > 0
    ) {
      return true;
    }

    this.plan.push({ structure: planPosition.structure, pos });
    return true;
  }
}
