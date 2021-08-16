import { StructurePatterns } from "structure-patterns";
import { RoomWrapper } from "structures/room-wrapper";

export class StructurePlan {
  private readonly terrain: RoomTerrain;
  private planned = false;
  private readonly pattern: StructurePatternPosition[];
  private plan: StructurePlanPosition[] = [];
  private roomw: RoomWrapper;

  public constructor(pattern: StructurePatternPosition[], private readonly room: Room) {
    this.terrain = room.getTerrain();
    this.pattern = pattern;
    this.roomw = new RoomWrapper(room);
  }

  public printPattern(): void {
    for (const i of this.pattern) {
      console.log(`${i.xOffset}, ${i.yOffset}, ${i.structure}`);
    }
  }

  public static parseStructurePlan(pattern: string[], room: Room): StructurePlan {
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

  public translate(x: number, y: number, ignoreStructures = false): boolean {
    this.planned = false;
    this.plan = [];
    let planOkSoFar = true;
    for (const planPosition of this.pattern) {
      const newPos = this.room.getPositionAt(planPosition.xOffset + x, planPosition.yOffset + y);
      if (!newPos || !this.translatePosition(planPosition, newPos, ignoreStructures)) {
        planOkSoFar = false;
      }
    }
    this.planned = planOkSoFar;
    return this.planned;
  }

  private translatePosition(
    planPosition: StructurePatternPosition,
    pos: RoomPosition,
    ignoreStructures = false
  ): boolean {
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
    if (!ignoreStructures) {
      const posStructures = this.room.lookForAt(LOOK_STRUCTURES, pos);
      if (posStructures.some(s => s.structureType !== STRUCTURE_ROAD)) {
        return false;
      }
      const posConstSites = this.room.lookForAt(LOOK_CONSTRUCTION_SITES, pos);
      if (posConstSites.some(s => s.structureType !== STRUCTURE_ROAD)) {
        return false;
      }

      // road overlap is ok, but don't place new construction site
      if (
        planPosition.structure === STRUCTURE_ROAD &&
        (posStructures.some(s => s.structureType === STRUCTURE_ROAD) ||
          posConstSites.some(s => s.structureType === STRUCTURE_ROAD))
      ) {
        return true;
      }
    }

    this.plan.push({ structure: planPosition.structure, pos });
    return true;
  }

  public drawPattern(): string {
    const plan = this.getPlan();
    if (plan) {
      plan.forEach(planPos => {
        this.roomw.visual.circle(planPos.pos);
      });
    }
    return this.roomw.visual.export();
  }
}
