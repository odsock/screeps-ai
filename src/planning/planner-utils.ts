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

  public static getPositionSpiral(centerPos: RoomPosition, maxRange: number): RoomPosition[] {
    let line: RoomPosition[] = [];
    
    let xOffset = 0;
    let yOffset = 0;
    let range = 0;
    let towerPos: RoomPosition = new RoomPosition(centerPos.x, centerPos.y, centerPos.roomName);
    while (towerPos.x < Constants.ROOM_SIZE && towerPos.y < Constants.ROOM_SIZE && towerPos.x > 0 && towerPos.y > 0) {
      console.log(`pos: ${towerPos}, xOffset: ${xOffset}, yOffset: ${yOffset}, range: ${range}`);
      line.push(towerPos);

      if (xOffset === yOffset) {
        yOffset++;
        range++;
      } else if(xOffset < range && yOffset === -range) {
        xOffset++;
      } else if (xOffset === range && yOffset < range) {
        yOffset++;
      } else if (xOffset > -range && yOffset === range) {
        xOffset--;
      } else if (xOffset === -range && yOffset > -range) {
        yOffset--;
      } else {
        console.log(`breaking loop`);
        break;
      }

      range++;
      
      towerPos.x = centerPos.x + xOffset;
      towerPos.y = centerPos.y + yOffset;
      towerPos = new RoomPosition(towerPos.x, towerPos.y, centerPos.roomName);
    }
    return line;
  }

  public static findColonyCenter(room: Room): RoomPosition {
    const myStructures = room.find(FIND_MY_STRUCTURES, {
      filter: s => s.structureType !== STRUCTURE_EXTENSION && s.structureType !== STRUCTURE_SPAWN && s.structureType !== STRUCTURE_CONTROLLER
    });
    const myRoadsAndContainers = room.find(FIND_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_CONTAINER ||
        s.structureType === STRUCTURE_ROAD ||
        s.structureType === STRUCTURE_WALL
    });
    console.log(`structures found: ${myStructures.length}, and ${myRoadsAndContainers.length}`);
    const structures = myRoadsAndContainers.concat(myStructures);

    let x = 0;
    let y = 0;
    let count = 0;
    for (const structure of structures) {
      x += structure.pos.x;
      y += structure.pos.y;
      count++;
    }
    const centerPos = new RoomPosition(x / count, y / count, room.name);
    return centerPos;
  }

}
