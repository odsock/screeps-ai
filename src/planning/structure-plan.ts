import { StructurePatterns } from "config/structure-patterns";
import { RoomWrapper } from "structures/room-wrapper";

interface StructurePatternPosition {
  xOffset: number;
  yOffset: number;
  structure: BuildableStructureConstant;
}
export interface StructurePlanPosition {
  pos: RoomPosition;
  structure: BuildableStructureConstant;
}

import { profile } from "../../screeps-typescript-profiler";

@profile
export class StructurePlan {
  private planned = false;
  private readonly pattern: StructurePatternPosition[];
  private plan: StructurePlanPosition[] = [];
  public readonly roomw: RoomWrapper;

  public constructor(pattern: StructurePatternPosition[], room: Room | string) {
    this.pattern = pattern;
    this.roomw = RoomWrapper.getInstance(room);
  }

  /** utility method for loading cached plan from JSON */
  public static fromPlanPositions(plan: StructurePlanPosition[]): StructurePlan {
    const sp = new StructurePlan([], plan[0].pos.roomName);
    sp.plan = plan;
    sp.planned = true;
    return sp;
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

  public getPlan(): StructurePlanPosition[] | undefined {
    return this.planned ? this.plan : undefined;
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
      const newPos = this.roomw.getPositionAt(planPosition.xOffset + x, planPosition.yOffset + y);
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
    const lookAtResult = this.roomw.lookAt(pos.x, pos.y);
    // can be blocked by wall, deposit, source
    if (lookAtResult.some(o => [LOOK_DEPOSITS, LOOK_SOURCES].some(lookConstant => lookConstant === o.type))) {
      return false;
    }
    if (lookAtResult.some(o => o.type === LOOK_TERRAIN && o.terrain === "wall")) {
      return false;
    }

    // can be blocked by non-road structure or construction site
    if (!ignoreStructures) {
      if (lookAtResult.some(o => o.type === LOOK_STRUCTURES && o.structure?.structureType !== STRUCTURE_ROAD)) {
        return false;
      }
      if (
        lookAtResult.some(
          o => o.type === LOOK_CONSTRUCTION_SITES && o.constructionSite?.structureType !== STRUCTURE_ROAD
        )
      ) {
        return false;
      }

      // road overlap is ok, but don't place new construction site
      if (
        planPosition.structure === STRUCTURE_ROAD &&
        lookAtResult.some(
          o =>
            (o.type === LOOK_STRUCTURES && o.structure?.structureType === STRUCTURE_ROAD) ||
            (o.type === LOOK_CONSTRUCTION_SITES && o.constructionSite?.structureType === STRUCTURE_ROAD)
        )
      ) {
        return true;
      }
    }

    this.plan.push({ structure: planPosition.structure, pos });
    return true;
  }
}
