import { RoomWrapper } from "structures/room-wrapper";
import { CostMatrixUtils } from "utils/cost-matrix-utils";

import { StructurePlanPosition } from "./structure-plan";

export class RoadPlan {
  private readonly roomw: RoomWrapper;
  private readonly costMatrixUtils: CostMatrixUtils;
  public constructor(private readonly room: Room) {
    this.roomw = RoomWrapper.getInstance(room.name);
    this.costMatrixUtils = CostMatrixUtils.getInstance();
  }

  public placeRoadSourceContainersToControllerContainers(): StructurePlanPosition[] {
    const controllerContainers = this.roomw.controllerContainers;
    if (controllerContainers.length <= 0) {
      return [];
    }

    const sourceContainers = this.roomw.sourceContainers;
    if (sourceContainers.length <= 0) {
      return [];
    }

    // get a path and place road for each pair of containers
    const plan: StructurePlanPosition[] = [];
    for (const sourceContainer of sourceContainers) {
      for (const controllerContainer of controllerContainers) {
        const path: PathFinderPath = this.planRoad(sourceContainer.pos, controllerContainer.pos, 1);
        if (!path.incomplete) {
          plan.push(...this.placeRoadOnPath(path));
        }
      }
    }
    return plan;
  }

  public placeRoadControllerToSpawn(): StructurePlanPosition[] {
    if (this.room.controller) {
      const spawns = this.room.find(FIND_MY_SPAWNS);
      if (spawns.length > 0) {
        const path = this.planRoad(spawns[0].pos, this.room.controller.pos, 1);
        if (!path.incomplete) {
          return this.placeRoadOnPath(path);
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
      console.log(`ERROR: road plan incomplete: ${String(origin)} -> ${String(goal)}`);
    }
    return path;
  }

  public placeRoadSpawnToExtensions(): StructurePlanPosition[] {
    const extensions = this.room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_EXTENSION });
    const spawns = this.room.find(FIND_MY_SPAWNS);
    for (const spawn of spawns) {
      for (const extension of extensions) {
        const path = this.planRoad(spawn.pos, extension.pos, 1);
        if (!path.incomplete) {
          const roadPlanPositions = this.placeRoadOnPath(path);
          return roadPlanPositions;
        }
      }
    }
    return [];
  }

  private checkForRoadAtPos(pos: RoomPosition): boolean {
    return (
      pos.look().filter(item => {
        const isRoad = item.structure?.structureType === STRUCTURE_ROAD;
        const isRoadSite = item.constructionSite?.structureType === STRUCTURE_ROAD;
        return isRoad || isRoadSite;
      }).length > 0
    );
  }

  private placeRoadOnPath(path: PathFinderPath): StructurePlanPosition[] {
    const planPositions: StructurePlanPosition[] = [];
    for (const pos of path.path) {
      const hasRoad = this.checkForRoadAtPos(pos);
      if (!hasRoad) {
        const result = this.room.createConstructionSite(pos, STRUCTURE_ROAD);
        if (result === OK) {
          planPositions.push({ pos, structure: STRUCTURE_ROAD });
        }
      }
    }
    return planPositions;
  }
}
