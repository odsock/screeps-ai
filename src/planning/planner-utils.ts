import { SockPuppetConstants } from "../config/sockpuppet-constants";
import { StructurePlan, StructurePlanPosition } from "planning/structure-plan";
import { CreepUtils } from "creep-utils";
import { MemoryUtils } from "./memory-utils";
import { profile } from "../../screeps-typescript-profiler";
import { StructurePatterns } from "config/structure-patterns";
import { RoomWrapper } from "structures/room-wrapper";

@profile
export class PlannerUtils {
  private static instance: PlannerUtils | undefined;
  public static getInstance(): PlannerUtils {
    this.instance = this.instance ?? new PlannerUtils();
    return this.instance;
  }

  public findSiteForPattern(
    roomPlan: StructurePlan,
    nearPosition: RoomPosition,
    cacheKey: string
  ): RoomPosition | undefined {
    const patternWidth = roomPlan.getPatternWidth();
    const patternHeight = roomPlan.getPatternHeight();
    const searchWidth = SockPuppetConstants.ROOM_SIZE - 1 - patternWidth;
    const searchHeight = SockPuppetConstants.ROOM_SIZE - 1 - patternHeight;
    const searchStartPos =
      MemoryUtils.getCachedPosition(`${cacheKey}_searchStartPos`) ??
      new RoomPosition(1, 1, nearPosition.roomName);
    let bestPos = MemoryUtils.getCachedPosition(`${cacheKey}_bestPos`);
    let minRange = SockPuppetConstants.MAX_DISTANCE;
    if (bestPos) {
      minRange = this.getRangeToPatternCenterAtPos(
        nearPosition,
        bestPos,
        patternWidth,
        patternHeight
      );
    }
    for (let x = searchStartPos.x; x < searchWidth; x++) {
      for (let y = searchStartPos.y; y < searchHeight; y++) {
        const searchPosition = new RoomPosition(x, y, nearPosition.roomName);
        MemoryUtils.setCachedPosition(`${cacheKey}_searchStartPos`, searchPosition, -1);
        const range = this.getRangeToPatternCenterAtPos(
          nearPosition,
          searchPosition,
          patternWidth,
          patternHeight
        );
        if (range < minRange && roomPlan.checkPatternAtPos(x, y)) {
          minRange = range;
          bestPos = searchPosition;
          MemoryUtils.setCachedPosition(`${cacheKey}_bestPos`, bestPos, -1);
        }
      }
    }
    return bestPos;
  }

  private getRangeToPatternCenterAtPos(
    nearPosition: RoomPosition,
    searchPosition: RoomPosition,
    patternWidth: number,
    patternHeight: number
  ): number {
    return nearPosition.getRangeTo(
      new RoomPosition(
        Math.round(searchPosition.x + patternWidth / 2),
        Math.round(searchPosition.y + patternHeight / 2),
        nearPosition.roomName
      )
    );
  }

  public findMidpoint(positions: RoomPosition[]): RoomPosition {
    const pointSum = positions.reduce(
      (midpoint: { x: number; y: number }, pos) => {
        midpoint.x += pos.x;
        midpoint.y += pos.y;
        return midpoint;
      },
      { x: 0, y: 0 }
    );
    return new RoomPosition(
      Math.round(pointSum.x / positions.length),
      Math.round(pointSum.y / positions.length),
      positions[0].roomName
    );
  }

  /*
   * Calculates a clockwise spiral from the center position out to a radius of max range. First step is to the right.
   */
  public getPositionSpiral(centerPos: RoomPosition, maxRange: number): RoomPosition[] {
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

  public findColonyCenter(room: Room): RoomPosition {
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
    const centerPos = new RoomPosition(Math.round(x / count), Math.round(y / count), room.name);
    return centerPos;
  }

  public placeTowerAtCenterOfColony(room: Room): ScreepsReturnCode {
    const centerPos = this.findColonyCenter(room);
    const line = this.getPositionSpiral(centerPos, 10);

    let ret: ScreepsReturnCode = ERR_NOT_FOUND;
    for (const pos of line) {
      ret = room.createConstructionSite(pos, STRUCTURE_TOWER);
      if (ret === OK) {
        break;
      }
    }
    return ret;
  }

  /** Place all structures in plan */
  public placeStructurePlan(
    roomw: RoomWrapper,
    planPositions: StructurePlanPosition[],
    SKIP_ROADS = false
  ): ScreepsReturnCode {
    for (const planPosition of planPositions) {
      if (
        (SKIP_ROADS || planPosition.structure !== STRUCTURE_ROAD) &&
        !this.placed(roomw, planPosition) &&
        this.haveRclForStructure(roomw, planPosition) &&
        !roomw.dismantleQueueIncludes(planPosition.pos)
      ) {
        const result = roomw.createConstructionSite(planPosition.pos, planPosition.structure);
        CreepUtils.consoleLogIfWatched(
          roomw,
          `place construction ${JSON.stringify(planPosition)}`,
          result
        );
        if (result !== OK) {
          return result;
        }
      }
    }
    return OK;
  }

  /**
   * Look at position for structure or construction site matching plan
   * Note: calling lookAt is cheaper than failing when already placed
   */
  private placed(room: Room, planPosition: StructurePlanPosition): boolean {
    const placed = room
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
  private haveRclForStructure(room: Room, planPosition: StructurePlanPosition): boolean {
    const structureCount = room.find(FIND_STRUCTURES, {
      filter: s => s.structureType === planPosition.structure
    }).length;
    const haveRcl =
      CONTROLLER_STRUCTURES[planPosition.structure][room.controller?.level ?? 0] > structureCount;
    return haveRcl;
  }

  /**
   * draw circles for plan positions
   */
  public drawPlan(room: Room, plan: StructurePlanPosition[]): void {
    if (plan) {
      plan.forEach(planPos => {
        const color = StructurePatterns.COLORS[planPos.structure];
        if (
          planPos.pos.look().some(item => {
            return (
              item.structure?.structureType === planPos.structure ||
              item.constructionSite?.structureType === planPos.structure
            );
          })
        ) {
          room.visual.circle(planPos.pos, { fill: color, opacity: 0.8, radius: 0.2 });
        } else {
          room.visual.circle(planPos.pos, {
            fill: "#00000000",
            stroke: color,
            lineStyle: "dashed",
            opacity: 0.8,
            radius: 0.5
          });
        }
      });
    }
  }

  /** Validates memory of structure information */
  // TODO call this somewhere
  public validateStructureInfo<T extends Structure>(info: StructureInfo<T>): ScreepsReturnCode {
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

  /**
   * Finds one adjacent structure of the specified type
   */
  public findAdjacentStructure<T extends Structure<StructureConstant>>(
    pos: RoomPosition,
    type: StructureConstant
  ): T | undefined {
    const room = Game.rooms[pos.roomName];
    if (room) {
      const lookResult = room
        .lookForAtArea(LOOK_STRUCTURES, pos.y - 1, pos.x - 1, pos.y + 1, pos.x + 1, true)
        .find(result => result.structure.structureType === type);
      if (lookResult?.structure) {
        return lookResult.structure as T;
      }
    }
    return undefined;
  }

  public placeAdjacentStructure<T extends Structure<StructureConstant>>(
    centerPos: RoomPosition,
    type: BuildableStructureConstant
  ): StructureInfo<T> | undefined {
    const positions = this.getPositionSpiral(centerPos, 1);
    const structurePos = positions.find(pos => pos.createConstructionSite(type) === OK);

    if (structurePos) {
      return {
        type,
        pos: MemoryUtils.packRoomPosition(structurePos)
      };
    }
    return undefined;
  }

  /** Finds position without terrain walls, sources, deposits, or controller */
  public findAvailableAdjacentPosition(
    roomw: RoomWrapper,
    centerPos: RoomPosition,
    avoidBottleneck = true
  ): RoomPosition | undefined {
    const lookResult = roomw.lookAtArea(
      centerPos.y - 1,
      centerPos.x - 1,
      centerPos.y + 1,
      centerPos.x + 1
    );
    const positions = this.getPositionSpiral(centerPos, 1).filter(
      pos =>
        !pos.isEqualTo(centerPos) &&
        lookResult[pos.y][pos.x].filter(
          l =>
            l.type === LOOK_DEPOSITS ||
            l.type === LOOK_SOURCES ||
            (l.type === LOOK_TERRAIN && l.terrain === "wall") ||
            (l.type === LOOK_STRUCTURES && l.structure?.structureType === "controller")
        ).length === 0
    );
    if (avoidBottleneck) {
      // add 1 point adjustment for closer position
      const closestToFirstSpawn = roomw.spawns[0].pos.findClosestByPath(positions);
      return _.max(
        positions,
        pos =>
          this.evaluateBottleneck(roomw, pos) +
          (!!closestToFirstSpawn && pos.isEqualTo(closestToFirstSpawn) ? 1 : 0)
      );
    }
    return positions[0];
  }

  /** Calculates narrowest gap between walls around position */
  public evaluateBottleneck(room: Room, pos: RoomPosition): number {
    const terrain = room.getTerrain();
    let minGap = 9999;
    // east west
    let gap = this.getGapSize(terrain, pos, 1, 0);
    if (gap < minGap) {
      minGap = gap;
    }
    // north south
    gap = this.getGapSize(terrain, pos, 0, 1);
    if (gap < minGap) {
      minGap = gap;
    }
    // southwest northeast
    gap = this.getGapSize(terrain, pos, 1, 1);
    if (gap < minGap) {
      minGap = gap;
    }
    // northwest southeast
    gap = this.getGapSize(terrain, pos, 1, -1);
    if (gap < minGap) {
      minGap = gap;
    }
    CreepUtils.consoleLogIfWatched(room, `bottleneck size for ${pos}: ${minGap}`);
    return minGap;
  }

  /** Calculate gap size on one axis from position */
  private getGapSize(
    terrain: RoomTerrain,
    pos: RoomPosition,
    xDirection: number,
    yDirection: number
  ): number {
    const SEARCH_DISTANCE = 5;
    let gap = 1;
    let leftWallFlag = false;
    let rightWallFlag = false;
    for (let i = 1; i < SEARCH_DISTANCE; i++) {
      const xLeft = pos.x - i * xDirection;
      const yDown = pos.y - i * yDirection;
      const ROOM_SIZE = SockPuppetConstants.ROOM_SIZE;
      if (
        !leftWallFlag &&
        xLeft < ROOM_SIZE &&
        xLeft > 0 &&
        yDown < ROOM_SIZE &&
        yDown > 0 &&
        terrain.get(xLeft, yDown) !== TERRAIN_MASK_WALL
      ) {
        gap += 1;
      } else {
        leftWallFlag = true;
      }
      const xRight = pos.x + i * xDirection;
      const yUp = pos.y + i * yDirection;
      if (
        !rightWallFlag &&
        xRight < ROOM_SIZE &&
        xRight > 0 &&
        yUp < ROOM_SIZE &&
        yUp > 0 &&
        terrain.get(xRight, yUp) !== TERRAIN_MASK_WALL
      ) {
        gap += 1;
      } else {
        rightWallFlag = true;
      }
      if (leftWallFlag && rightWallFlag) {
        break;
      }
    }
    return gap < SEARCH_DISTANCE ? gap : SEARCH_DISTANCE;
  }
}
