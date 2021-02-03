import { StructurePlan } from "planning/structure-plan";
import config from "../constants";

export class PlannerUtils {

  public constructor(private readonly room: Room) {}

  public static findSiteForPattern(pattern: StructurePlanPosition[], room: Room): StructurePlan {
    const structurePlan = new StructurePlan(pattern, room);
    const patternWidth = structurePlan.getWidth();
    const patternHeight = structurePlan.getHeight();
    const searchWidth = config.ROOM_SIZE - 1 - patternWidth;
    const searchHeight = config.ROOM_SIZE - 1 - patternHeight;
    let closestSite: { x: number, y: number } | undefined;
    let shortestRange: number = config.MAX_DISTANCE;

    // search whole room
    for (let x = 1; x < searchWidth; x++) {
      for (let y = 1; y < searchHeight; y++) {
        const range = this.getPatternRangeFromSpawn(x, patternWidth, y, patternHeight, room);
        if (range) {
          if (range >= shortestRange) {
            continue;
          }
          else if (structurePlan.translate(x, y)) {
            shortestRange = range;
            closestSite = { x, y };
          }
        }
      }
    }

    // return best site found
    if (closestSite) {
      structurePlan.translate(closestSite.x, closestSite.y);
      console.log(`closest site: ${closestSite.x},${closestSite.y}`);
    }
    else {
      console.log(`No site for pattern found.`);
    }
    return structurePlan;
  }

  public static getPatternRangeFromSpawn(x: number, patternWidth: number, y: number, patternHeight: number, room: Room): number | undefined {
    // use center of patten for ranging
    const posCenter = room.getPositionAt(x + patternWidth / 2, y + patternHeight / 2);
    const closestSpawn = posCenter?.findClosestByRange(FIND_MY_SPAWNS);
    if(closestSpawn) {
      return posCenter?.getRangeTo(closestSpawn);
    }
    return undefined;
  }
}