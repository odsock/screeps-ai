import { RoomWrapper } from "structures/room-wrapper";
import { CostMatrixUtils } from "utils/cost-matrix-utils";

import { StructurePlanPosition } from "./structure-plan";
import { CreepUtils, LogLevel } from "creep-utils";

import { profile } from "../../screeps-typescript-profiler";

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
          return path.path.map(pos => {
            return { pos, structure: STRUCTURE_ROAD };
          });
        }
      }
    }
    return [];
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
