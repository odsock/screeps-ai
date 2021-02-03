export class StructurePlan {
  private _plan: RoomPosition[] = [];
  private pattern: StructurePlanPosition[];

  constructor(pattern: StructurePlanPosition[]) {
    this.pattern = pattern;
  }

  public getWidth(): number {
    return this.pattern.reduce<number>((max, pos) => { return max > pos.xOffset ? max : pos.xOffset}, 0);
  }

  public getHeight(): number {
    return this.pattern.reduce<number>((max, pos) => { return max > pos.yOffset ? max : pos.yOffset}, 0);
  }

  public getStructureAt(pos: RoomPosition): StructureConstant | null {
    if(this._plan.length > 0) {
      return this.pattern[this._plan.indexOf(pos)].structure;
    }
    return null;
  }

  public translate(x: number, y: number, roomName: string): void {
    this._plan = this.pattern.map<RoomPosition>((pos) => {
      const newPos = Game.rooms[roomName].getPositionAt(pos.xOffset + x, pos.yOffset + y);
      if (newPos) {
        return newPos;
      }
      else {
        throw new Error(`Translated pattern outside room: ${x}, ${y}`);
      }
    });
  }

  get plan(): RoomPosition[] {
    return this._plan;
  }
}
