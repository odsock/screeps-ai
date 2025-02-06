import { RoomWrapper } from "structures/room-wrapper";
import { CostMatrixUtils } from "utils/cost-matrix-utils";

import { StructurePlanPosition } from "./structure-plan";
import { CreepUtils, LogLevel } from "creep-utils";

import { profile } from "../../screeps-typescript-profiler";
import { MemoryUtils } from "./memory-utils";

@profile
export class RoadPlan {
  private readonly roomw: RoomWrapper;
  private readonly costMatrixUtils: CostMatrixUtils;
  public constructor(private readonly room: Room) {
    this.roomw = RoomWrapper.getInstance(room.name);
    this.costMatrixUtils = CostMatrixUtils.getInstance();
  }

  public planRoadSourceContainersToControllerContainers(
    sourceContainerPositions: RoomPosition[],
    controllerContainerPosition: RoomPosition
  ): StructurePlanPosition[] {
    CreepUtils.log(LogLevel.DEBUG, "road planning: sources to controller");
    const plan = [];
    // get a path and place road for each pair of containers
    for (const sourceContainerPosition of sourceContainerPositions) {
      const path: PathFinderPath = this.planRoad(
        sourceContainerPosition,
        controllerContainerPosition,
        1
      );
      if (!path.incomplete) {
        plan.push(
          ...path.path.map(pos => {
            return { pos, structure: STRUCTURE_ROAD };
          })
        );
        this.cachePath(path);
      } else {
        return [];
      }
    }
    return plan;
  }

  public planRoadControllerToSpawn(): StructurePlanPosition[] {
    if (this.room.controller) {
      const spawns = this.room.find(FIND_MY_SPAWNS);
      if (spawns.length > 0) {
        const path = this.planRoad(spawns[0].pos, this.room.controller.pos, 2);
        if (!path.incomplete) {
          this.cachePath(path);
          return path.path.map(pos => {
            return { pos, structure: STRUCTURE_ROAD };
          });
        }
      }
    }
    return [];
  }

  private cachePath(path: PathFinderPath): void {
    if (path.path.length === 0) {
      CreepUtils.log(LogLevel.ERROR, `empty path passed to caching: ${JSON.stringify(path)}`);
      return;
    }
    const start = path.path[0];
    const end = path.path[path.path.length - 1];
    const packedStart = MemoryUtils.packRoomPosition(start);
    const packedEnd = MemoryUtils.packRoomPosition(end);
    const cacheKeyTo = `${this.roomw.name}_path_${packedStart}_to_${packedEnd}`;
    const cacheKeyFrom = `${this.roomw.name}_path_${packedEnd}_to_${packedStart}`;
    MemoryUtils.setCache(cacheKeyTo, path.path, -1);
    MemoryUtils.setCache(cacheKeyFrom, path.path.reverse(), -1);
    const roomPaths = MemoryUtils.getCache<string[]>(`${this.roomw.name}_paths`) ?? [];
    roomPaths.push(cacheKeyTo);
    MemoryUtils.setCache(`${this.roomw.name}_paths`, [...new Set(roomPaths)], -1); // cache uniqueified list of path keys
  }

  public planRoad(origin: RoomPosition, goal: RoomPosition, range = 0): PathFinderPath {
    const path = PathFinder.search(
      origin,
      { pos: goal, range },
      { swampCost: 2, plainCost: 2, roomCallback: this.costMatrixUtils.roadPlanningRoomCallback }
    );
    if (path.incomplete) {
      CreepUtils.log(
        LogLevel.DEBUG,
        `road planing: incomplete: ${String(origin)} -> ${String(goal)}`
      );
    }
    return path;
  }

  public planRoadSpawnToExtensions(): StructurePlanPosition[] {
    const extensions = this.room.find(FIND_MY_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_EXTENSION
    });
    const spawns = this.room.find(FIND_MY_SPAWNS);
    const plan = [];
    for (const spawn of spawns) {
      for (const extension of extensions) {
        const path = this.planRoad(spawn.pos, extension.pos, 1);
        if (!path.incomplete) {
          this.cachePath(path);
          plan.push(
            ...path.path.map(pos => {
              return { pos, structure: STRUCTURE_ROAD };
            })
          );
        } else {
          return [];
        }
      }
    }
    return plan;
  }
}
