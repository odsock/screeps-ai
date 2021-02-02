export class StructurePlan {
  private _plan: RoomPosition[] = [];
  private pattern: StructurePlanPosition[];

  constructor(pattern: StructurePlanPosition[]) {
    this.pattern = pattern;
  }

  public translate(x: number, y: number, roomName: string): void {
    this._plan = this.pattern.map<RoomPosition>((pos) => {
      const newPos = Game.rooms[roomName].getPositionAt(pos.xOffset + x, pos.yOffset + y);
      if (newPos) {
        return newPos;
      }
      else {
        // BUG: keep this from happening
        throw new Error(`Translated pattern outside room: ${x}, ${y}`);
      }
    });
  }

  get plan(): RoomPosition[] {
    return this._plan;
  }
}
