import { SockPuppetConstants } from "../config/sockpuppet-constants";
import { StructurePlan, StructurePlanPosition } from "planning/structure-plan";
import { CreepUtils } from "creep-utils";
import { RoomWrapper } from "structures/room-wrapper";
import { MemoryUtils } from "./memory-utils";

export class PlannerUtils {
  public static findSiteForPattern(
    pattern: string[],
    room: Room,
    nearPosition: RoomPosition,
    ignoreStructures = false // ignore existing structures to avoid blocking self by partially built sites
  ): StructurePlanPosition[] | undefined {
    console.log(`finding pattern site in ${nearPosition.roomName}`);
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
        if (range >= shortestRange) {
          continue;
        } else if (structurePlan.translate(x, y, ignoreStructures)) {
          shortestRange = range;
          closestSite = { x, y };
        }
      }
    }

    // return best site found
    if (closestSite) {
      structurePlan.translate(closestSite.x, closestSite.y, ignoreStructures);
      console.log(`closest site: ${closestSite.x},${closestSite.y}`);
      return structurePlan.getPlan();
    }
    console.log(`No site for pattern found.`);
    return undefined;
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
  ): RoomPosition | undefined {
    const positions = this.getPositionSpiral(position, 1);
    const placedPosition = positions.find(pos => pos.createConstructionSite(structureConstant) === OK);
    return placedPosition;
  }

  /*
   * Calculates a clockwise spiral from the center position out to a radius of max range. First step is to the right.
   */
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
    const myStructures: Structure[] = room.find(FIND_MY_STRUCTURES, {
      filter: s =>
        s.structureType !== STRUCTURE_EXTENSION &&
        s.structureType !== STRUCTURE_SPAWN &&
        s.structureType !== STRUCTURE_CONTROLLER
    });
    const myRoadsAndContainers: Structure[] = room.find(FIND_STRUCTURES, {
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

  public static placeStructurePlan({
    planPositions,
    roomw,
    skipRoads = false
  }: {
    planPositions: StructurePlanPosition[];
    roomw: RoomWrapper;
    skipRoads?: boolean;
  }): ScreepsReturnCode {
    if (!planPositions) {
      CreepUtils.consoleLogIfWatched(roomw, `failed to place plan`);
      return ERR_NOT_FOUND;
    } else {
      for (const planPosition of planPositions) {
        if (skipRoads && planPosition.structure === STRUCTURE_ROAD) {
          continue;
        }

        if (!PlannerUtils.placed(roomw, planPosition) && PlannerUtils.haveRcl(roomw, planPosition)) {
          const result = roomw.createConstructionSite(planPosition.pos, planPosition.structure);
          CreepUtils.consoleLogIfWatched(roomw, `place construction ${JSON.stringify(planPosition)}`, result);
          if (result !== OK) {
            return result;
          }
        }
      }
    }
    return OK;
  }

  /**
   * calling lookAt is cheaper than failing when already placed
   */
  private static placed(roomw: RoomWrapper, planPosition: StructurePlanPosition): boolean {
    const placed = roomw
      .lookAt(planPosition.pos)
      .some(
        item =>
          item.structure?.structureType === planPosition.structure ||
          item.constructionSite?.structureType === planPosition.structure
      );
    return placed;
  }

  /**
   *  check RCL yourself before attempting create construction site
   */
  private static haveRcl(roomw: RoomWrapper, planPosition: StructurePlanPosition): boolean {
    const structureCount = roomw.find(FIND_STRUCTURES, {
      filter: s => s.structureType === planPosition.structure
    }).length;
    const haveRcl = CONTROLLER_STRUCTURES[planPosition.structure][roomw.controller?.level ?? 0] > structureCount;
    return haveRcl;
  }

  /**
   * draw circles for incomplete parts of plan
   */
  public static drawPlan(plan: StructurePlanPosition[], room: Room): void {
    if (plan) {
      plan
        .filter(
          planPos =>
            !planPos.pos
              .look()
              .some(
                item =>
                  item.structure?.structureType === planPos.structure ||
                  item.constructionSite?.structureType === planPos.structure
              )
        )
        .forEach(planPos => {
          room.visual.circle(planPos.pos);
        });
    }
  }

  public static validateStructureInfo<T extends Structure>(info: StructureInfo<T>): ScreepsReturnCode {
    // check for valid container id
    if (info.id && Game.getObjectById(info.id)) {
      return OK;
    } else {
      info.id = undefined;
    }

    // check for valid construction site id
    if (info.constructionSiteId) {
      const constructionSite = Game.getObjectById(info.constructionSiteId);
      if (constructionSite?.structureType === info.type) {
        return OK;
      } else {
        info.constructionSiteId = undefined;
      }
    }

    // check for structure at pos
    if (info.pos) {
      const containerMemPos = MemoryUtils.unpackRoomPosition(info.pos);
      const lookResult = containerMemPos
        .lookFor(LOOK_STRUCTURES)
        .find(structure => structure.structureType === info.type);
      if (lookResult) {
        info.id = lookResult.id as Id<T>;
        return OK;
      }
      // check for construction site at pos
      const constructionSite = containerMemPos
        .lookFor(LOOK_CONSTRUCTION_SITES)
        .find(structure => structure.structureType === info.type);
      if (constructionSite) {
        info.constructionSiteId = constructionSite.id;
        return OK;
      }
    }
    return ERR_NOT_FOUND;
  }

  public static findAdjacentContainer(pos: RoomPosition): StructureContainer | undefined {
    const room = Game.rooms[pos.roomName];
    if (room) {
      const lookResult = room
        .lookForAtArea(LOOK_STRUCTURES, pos.y - 1, pos.x - 1, pos.y + 1, pos.x + 1, true)
        .find(structure => structure.structure.structureType === STRUCTURE_CONTAINER);
      if (lookResult?.structure) {
        return lookResult.structure as StructureContainer;
      }
    }
    return undefined;
  }
}
