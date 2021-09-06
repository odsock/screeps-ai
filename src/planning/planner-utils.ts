import { SockPuppetConstants } from "../config/sockpuppet-constants";
import { StructurePlan } from "planning/structure-plan";
import { CreepUtils } from "creep-utils";

export class PlannerUtils {
  public static findSiteForPattern(
    pattern: string[],
    room: Room,
    nearPosition: RoomPosition,
    ignoreStructures = false
  ): StructurePlan {
    console.log(`finding site`);
    const structurePlan = StructurePlan.parseStructurePlan(pattern, room);
    const patternWidth = structurePlan.getWidth();
    const patternHeight = structurePlan.getHeight();
    const searchWidth = SockPuppetConstants.ROOM_SIZE - 1 - patternWidth;
    const searchHeight = SockPuppetConstants.ROOM_SIZE - 1 - patternHeight;

    // search whole room
    let closestSite: { x: number; y: number } | undefined;
    let shortestRange: number = SockPuppetConstants.MAX_DISTANCE;
    for (let x = 1; x < searchWidth; x++) {
      for (let y = 1; y < searchHeight; y++) {
        const range = nearPosition.getRangeTo(
          new RoomPosition(x + patternWidth / 2, y + patternHeight / 2, nearPosition.roomName)
        );
        if (range) {
          if (range >= shortestRange) {
            continue;
          } else if (structurePlan.translate(x, y, ignoreStructures)) {
            shortestRange = range;
            closestSite = { x, y };
          }
        }
      }
    }

    // return best site found
    if (closestSite) {
      structurePlan.translate(closestSite.x, closestSite.y, ignoreStructures);
      console.log(`closest site: ${closestSite.x},${closestSite.y}`);
    } else {
      console.log(`No site for pattern found.`);
    }
    return structurePlan;
  }

  public static findMidpoint(positions: RoomPosition[]): RoomPosition {
    const pointSum = positions.reduce(
      (midpoint: { x: number; y: number }, pos) => {
        midpoint.x += pos.x;
        midpoint.y += pos.y;
        return midpoint;
      },
      { x: 0, y: 0 }
    );
    return new RoomPosition(pointSum.x / positions.length, pointSum.y / positions.length, positions[0].roomName);
  }

  /**
   * Creates construction site next to position.
   * Returns ID of construction site, or null if failed to create it.
   */
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
    const line: RoomPosition[] = [];
    let x = 0;
    let y = 0;
    let dx = 0;
    let dy = -1;
    let pos: RoomPosition;

    for (let i = 0; i < Math.pow(maxRange * 2 + 1, 2); i++) {
      if (
        centerPos.x + x < SockPuppetConstants.ROOM_SIZE - 2 &&
        centerPos.x + x > 1 &&
        centerPos.y + y < SockPuppetConstants.ROOM_SIZE - 2 &&
        centerPos.y + y > 1
      ) {
        pos = new RoomPosition(centerPos.x + x, centerPos.y + y, centerPos.roomName);
        line.push(pos);
      }

      if (x === y || (x === -y && x < 0) || (x === 1 - y && x > 0)) {
        const temp = dx;
        dx = -dy;
        dy = temp;
      }

      x = x + dx;
      y = y + dy;
    }
    return line;
  }

  public static findColonyCenter(room: Room): RoomPosition {
    const myStructures = room.find(FIND_MY_STRUCTURES, {
      filter: s =>
        s.structureType !== STRUCTURE_EXTENSION &&
        s.structureType !== STRUCTURE_SPAWN &&
        s.structureType !== STRUCTURE_CONTROLLER
    });
    const myRoadsAndContainers = room.find(FIND_STRUCTURES, {
      filter: s =>
        s.structureType === STRUCTURE_CONTAINER ||
        s.structureType === STRUCTURE_ROAD ||
        s.structureType === STRUCTURE_WALL
    });
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

  private static readonly isObstacleLookup = new Map<StructureConstant, boolean>(
    OBSTACLE_OBJECT_TYPES.map(typeName => [typeName as StructureConstant, true])
  );

  public static isEnterable(pos: RoomPosition): boolean {
    return pos.look().every(item => {
      switch (item.type) {
        case "terrain": {
          return item.terrain !== "wall";
        }

        case "structure": {
          return item.structure && !PlannerUtils.isObstacleLookup.get(item.structure.structureType);
        }

        default:
          return true;
      }
    });
  }

  public static getAvailableStructureCount(structureConstant: BuildableStructureConstant, room: Room): number {
    let available = 0;
    const rcl = room.controller?.level;
    if (rcl) {
      const max = CONTROLLER_STRUCTURES[structureConstant][rcl];
      const built = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === structureConstant }).length;
      const placed = room.find(FIND_MY_CONSTRUCTION_SITES, {
        filter: s => s.structureType === structureConstant
      }).length;
      available = max - built - placed;
    }
    console.log(`${room.name}: ${structureConstant}s available: ${available}`);
    return available;
  }

  public static placeTowerAtCenterOfColony(room: Room): ScreepsReturnCode {
    const centerPos = PlannerUtils.findColonyCenter(room);
    const line = PlannerUtils.getPositionSpiral(centerPos, 10);

    let ret: ScreepsReturnCode = ERR_NOT_FOUND;
    for (const pos of line) {
      ret = room.createConstructionSite(pos, STRUCTURE_TOWER);
      if (ret === OK) {
        break;
      }
    }
    return ret;
  }

  // TODO: find a place for spawn with simple rules
  public static placeFirstSpawn(room: Room): ScreepsReturnCode {
    console.log(`called stub spawn placer: ${room.name}`);
    // if (this.room.controller) {
    //   this.room.controller.pos.
    // }
    return ERR_INVALID_TARGET;
  }

  public static placeStructurePlan(
    structurePlan: StructurePlan,
    allowOverlap = true,
    ignoreRCL = true,
    skipRoads = false
  ): ScreepsReturnCode {
    const plan = structurePlan.getPlan();
    if (plan) {
      CreepUtils.consoleLogIfWatched(structurePlan.roomw, `found placement for plan`);
      for (const planPosition of plan) {
        if (skipRoads && planPosition.structure === STRUCTURE_ROAD) {
          CreepUtils.consoleLogIfWatched(structurePlan.roomw, `skipping road at ${String(planPosition.pos)}`);
          continue;
        }

        const result = structurePlan.roomw.createConstructionSite(planPosition.pos, planPosition.structure);
        CreepUtils.consoleLogIfWatched(
          structurePlan.roomw,
          `place ${String(planPosition.pos)} ${planPosition.structure}`,
          result
        );
        if (result === ERR_RCL_NOT_ENOUGH && ignoreRCL) {
          continue;
        }

        if (result === ERR_INVALID_TARGET && allowOverlap) {
          if (
            structurePlan.roomw
              .lookAt(planPosition.pos)
              .some(
                item =>
                  item.structure?.structureType === planPosition.structure ||
                  item.constructionSite?.structureType === planPosition.structure
              )
          ) {
            continue;
          } else {
            const resultString = String(SockPuppetConstants.ERROR_CODE_LOOKUP.get(result));
            console.log(
              `${planPosition.structure} pos: ${String(planPosition.pos)}, failed: ${result} ${resultString}`
            );
            return result;
          }
        }
      }
    }
    CreepUtils.consoleLogIfWatched(structurePlan.roomw, `failed to place plan`);
    return ERR_NOT_FOUND;
  }
}
