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
  private pattern: StructurePatternPosition[] = [];
  private readonly plan: BuildableStructureConstant[][] = [];
  private readonly roomw: RoomWrapper;

  public constructor(room: Room | RoomWrapper | string) {
    this.roomw = RoomWrapper.getInstance(room);
  }

  /** Sets pattern for all pattern functions */
  public setPattern(pattern: string[]): this {
    this.pattern = this.parseStructurePattern(pattern);
    return this;
  }

  /** Print pattern offset positions and structure types to console */
  public printPattern(): void {
    for (const i of this.pattern) {
      console.log(`${i.xOffset}, ${i.yOffset}, ${i.structure}`);
    }
  }

  /** Print pattern offset positions and structure types to console */
  public printPlan(): void {
    const planPositions = this.getPlan();
    for (const i of planPositions) {
      console.log(`${i.pos.x}, ${i.pos.y}, ${i.structure}`);
    }
  }

  /** Parse pattern constants into structure arrays */
  private parseStructurePattern(pattern: string[]): StructurePatternPosition[] {
    const structurePattern: StructurePatternPosition[] = [];
    for (let i = 0; i < pattern.length; i++) {
      for (let j = 0; j < pattern[i].length; j++) {
        const structureConstant = StructurePatterns.CHARACTERS[pattern[i].charAt(j)];
        if (structureConstant) {
          structurePattern.push({ xOffset: j, yOffset: i, structure: structureConstant });
        }
      }
    }
    return structurePattern;
  }

  public getPlan(): StructurePlanPosition[] {
    const planPositions: StructurePlanPosition[] = [];
    for (let i = 0; i < this.plan.length; i++) {
      for (let j = 0; j < this.plan[i].length; j++) {
        const structure = this.plan[i][j];
        if (structure) {
          planPositions.push({ pos: new RoomPosition(i, j, this.roomw.name), structure: structure });
        }
      }
    }
    return planPositions;
  }

  public getPatternWidth(): number {
    return this.pattern.reduce<number>((max, pos) => {
      return max > pos.xOffset ? max : pos.xOffset;
    }, 0);
  }

  public getPatternHeight(): number {
    return this.pattern.reduce<number>((max, pos) => {
      return max > pos.yOffset ? max : pos.yOffset;
    }, 0);
  }

  /** Check structure pattern against room and plan at position */
  public checkPatternAtPos(x: number, y: number, ignoreStructures = false): boolean {
    for (const patternPosition of this.pattern) {
      // use room.getPositionAt() because position may be out of range, and it returns null instead of throwing
      const newPos = this.roomw.getPositionAt(patternPosition.xOffset + x, patternPosition.yOffset + y);
      if (!newPos) {
        return false;
      }
      const positionOk = this.checkPosition(newPos, ignoreStructures);
      if (!positionOk) {
        return false;
      }
    }
    return true;
  }

  /** Apply structure pattern to plan at position */
  public mergePatternAtPos(pos: RoomPosition) {
    const x = pos.x;
    const y = pos.y;
    for (const patternPosition of this.pattern) {
      this.plan[patternPosition.xOffset + x][patternPosition.yOffset + y] = patternPosition.structure;
    }
  }

  private checkPosition(pos: RoomPosition, ignoreStructures = false): boolean {
    // don't plan the same position twice
    if (this.plan[pos.x][pos.y]) {
      return false;
    }
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
      if (
        lookAtResult.some(
          o =>
            (o.type === LOOK_STRUCTURES && o.structure?.structureType !== STRUCTURE_ROAD) ||
            (o.type === LOOK_CONSTRUCTION_SITES && o.constructionSite?.structureType !== STRUCTURE_ROAD)
        )
      ) {
        return false;
      }
    }
    return true;
  }
}
