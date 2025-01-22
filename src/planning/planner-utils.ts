import { SockPuppetConstants } from "../config/sockpuppet-constants";
import { StructurePlan, StructurePlanPosition } from "planning/structure-plan";
import { CreepUtils } from "creep-utils";
import { MemoryUtils } from "./memory-utils";

import { profile } from "../../screeps-typescript-profiler";

@profile
export class PlannerUtils {
  public constructor(private readonly room: Room) {}

  public findSiteForPattern(
    pattern: string[],
    nearPosition: RoomPosition,
    ignoreStructures = false // ignore existing structures to avoid blocking self by partially built sites
  ): StructurePlanPosition[] | undefined {
    console.log(`finding pattern site in ${nearPosition.roomName}`);
    const structurePlan = StructurePlan.parseStructurePlan(pattern, this.room);
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

  public findMidpoint(positions: RoomPosition[]): RoomPosition {
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

  public findColonyCenter(): RoomPosition {
    const myStructures: Structure[] = this.room.find(FIND_MY_STRUCTURES, {
      filter: s =>
        s.structureType !== STRUCTURE_EXTENSION &&
        s.structureType !== STRUCTURE_SPAWN &&
        s.structureType !== STRUCTURE_CONTROLLER
    });
    const myRoadsAndContainers: Structure[] = this.room.find(FIND_STRUCTURES, {
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
    const centerPos = new RoomPosition(x / count, y / count, this.room.name);
    return centerPos;
  }

  public placeTowerAtCenterOfColony(): ScreepsReturnCode {
    const centerPos = this.findColonyCenter();
    const line = this.getPositionSpiral(centerPos, 10);

    let ret: ScreepsReturnCode = ERR_NOT_FOUND;
    for (const pos of line) {
      ret = this.room.createConstructionSite(pos, STRUCTURE_TOWER);
      if (ret === OK) {
        break;
      }
    }
    return ret;
  }

  public placeStructurePlan({
    planPositions,
    skipRoads = false
  }: {
    planPositions: StructurePlanPosition[];
    skipRoads?: boolean;
  }): ScreepsReturnCode {
    if (!planPositions) {
      CreepUtils.consoleLogIfWatched(this.room, `failed to place plan`);
      return ERR_NOT_FOUND;
    } else {
      for (const planPosition of planPositions) {
        if (skipRoads && planPosition.structure === STRUCTURE_ROAD) {
          continue;
        }

        if (!this.placed(planPosition) && this.haveRclForStructure(planPosition)) {
          const result = this.room.createConstructionSite(planPosition.pos, planPosition.structure);
          CreepUtils.consoleLogIfWatched(this.room, `place construction ${JSON.stringify(planPosition)}`, result);
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
  private placed(planPosition: StructurePlanPosition): boolean {
    const placed = this.room
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
  private haveRclForStructure(planPosition: StructurePlanPosition): boolean {
    const structureCount = this.room.find(FIND_STRUCTURES, {
      filter: s => s.structureType === planPosition.structure
    }).length;
    const haveRcl = CONTROLLER_STRUCTURES[planPosition.structure][this.room.controller?.level ?? 0] > structureCount;
    return haveRcl;
  }

  /**
   * draw circles for incomplete parts of plan
   */
  public drawPlan(plan: StructurePlanPosition[]): void {
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
          this.room.visual.circle(planPos.pos);
        });
    }
  }

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
}
