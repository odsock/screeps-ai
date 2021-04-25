import { Constants } from "../constants";
import { StructurePlan } from "planning/structure-plan";

export class PlannerUtils {
  public constructor(private readonly room: Room) {}

  // TODO: don't assume spawn for center
  public static findSiteForPattern(pattern: string[], room: Room): StructurePlan {
    const structurePlan = StructurePlan.buildStructurePlan(pattern, room);
    const patternWidth = structurePlan.getWidth();
    const patternHeight = structurePlan.getHeight();
    const searchWidth = Constants.ROOM_SIZE - 1 - patternWidth;
    const searchHeight = Constants.ROOM_SIZE - 1 - patternHeight;
    let closestSite: { x: number; y: number } | undefined;
    let shortestRange: number = Constants.MAX_DISTANCE;

    // search whole room
    for (let x = 1; x < searchWidth; x++) {
      for (let y = 1; y < searchHeight; y++) {
        const range = this.getPatternRangeFromSpawn(x, patternWidth, y, patternHeight, room);
        if (range) {
          if (range >= shortestRange) {
            continue;
          } else if (structurePlan.translate(x, y)) {
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
    } else {
      console.log(`No site for pattern found.`);
    }
    return structurePlan;
  }

  public static getPatternRangeFromSpawn(
    x: number,
    patternWidth: number,
    y: number,
    patternHeight: number,
    room: Room
  ): number | undefined {
    // use center of pattern for ranging
    const posCenter = room.getPositionAt(x + patternWidth / 2, y + patternHeight / 2);
    const closestSpawn = posCenter?.findClosestByRange(FIND_MY_SPAWNS);
    if (closestSpawn) {
      return posCenter?.getRangeTo(closestSpawn);
    }
    return undefined;
  }

  public static placeStructureAdjacent(
    position: RoomPosition,
    structureConstant: BuildableStructureConstant
  ): string | null {
    let xOffset = 0;
    let yOffset = 0;
    const startPos = new RoomPosition(position.x - 1, position.y - 1, position.roomName);
    let pos = startPos;
    while (pos.createConstructionSite(structureConstant) !== OK) {
      if (xOffset < 2 && yOffset === 0) {
        xOffset++;
      } else if (xOffset === 2 && yOffset < 2) {
        yOffset++;
      } else if (xOffset > 0 && yOffset === 2) {
        xOffset--;
      } else if (xOffset === 0 && yOffset > 0) {
        yOffset--;
      }

      // Give up if back to start position
      if (xOffset === yOffset && xOffset === 0) {
        return null;
      }

      pos = new RoomPosition(startPos.x + xOffset, startPos.y + yOffset, startPos.roomName);
    }

    const structure = pos.lookFor(LOOK_CONSTRUCTION_SITES);
    if (structure.length > 0) {
      return structure[0].id;
    }
    return null;
  }
}
