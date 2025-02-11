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
import { SockPuppetConstants } from "config/sockpuppet-constants";

@profile
export class StructurePlan {
  private pattern: StructurePatternPosition[] = [];
  private readonly plan: BuildableStructureConstant[][] = [];
  private readonly roomw: RoomWrapper;

  public constructor(room: Room | RoomWrapper | string) {
    this.roomw = RoomWrapper.getInstance(room);
    //init the plan matrix
    this.init();
  }

  private init(): void {
    for (let i = 0; i < SockPuppetConstants.ROOM_SIZE; i++) {
      this.plan[i] = [];
    }
  }

  public clear(): void {
    this.pattern = [];
    this.init();
  }

  public setPlan(planPositions: StructurePlanPosition[]): void {
    planPositions.forEach(p => this.setPlanPosition(p.pos, p.structure));
  }

  /** Sets pattern for all pattern functions */
  public setPattern(pattern: string[]): this {
    this.pattern = this.parseStructurePattern(pattern);
    return this;
  }

  public setPlanPosition(pos: RoomPosition, structureType: BuildableStructureConstant): void {
    this.plan[pos.x][pos.y] = structureType;
  }

  public getPlanPosition(pos: RoomPosition): BuildableStructureConstant | undefined {
    return this.plan[pos.x][pos.y];
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
          planPositions.push({
            pos: new RoomPosition(i, j, this.roomw.name),
            structure: structure
          });
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
  public checkPatternAtPos(x: number, y: number): boolean {
    for (const patternPosition of this.pattern) {
      // use room.getPositionAt() because position may be out of range, and it returns null instead of throwing
      const newPos = this.roomw.getPositionAt(
        patternPosition.xOffset + x,
        patternPosition.yOffset + y
      );
      if (!newPos) {
        return false;
      }
      const positionOk = this.checkPosition(newPos, patternPosition.structure);
      if (!positionOk) {
        return false;
      }
    }
    return true;
  }

  /** Apply structure pattern to plan at position */
  public mergePatternAtPos(pos: RoomPosition): void {
    const x = pos.x;
    const y = pos.y;
    for (const patternPosition of this.pattern) {
      this.plan[patternPosition.xOffset + x][patternPosition.yOffset + y] =
        patternPosition.structure;
    }
  }

  /** Look at room position to predict valid construction site */
  public checkPosition(pos: RoomPosition, structureType: BuildableStructureConstant): boolean {
    // don't plan the same position twice, but allow road overlap
    if (this.plan[pos.x][pos.y]) {
      if (this.plan[pos.x][pos.y] === STRUCTURE_ROAD && structureType === STRUCTURE_ROAD) {
        return true;
      }
      return false;
    }
    const lookAtResult = this.roomw.lookAt(pos.x, pos.y);
    // can be blocked by wall, deposit, source
    if (
      lookAtResult.some(o =>
        [LOOK_DEPOSITS, LOOK_SOURCES].some(lookConstant => lookConstant === o.type)
      )
    ) {
      return false;
    }
    if (lookAtResult.some(o => o.type === LOOK_TERRAIN && o.terrain === "wall")) {
      return false;
    }
    return true;
  }
}
