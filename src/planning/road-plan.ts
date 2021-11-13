import { RoomWrapper } from "structures/room-wrapper";
import { CostMatrixUtils } from "utils/cost-matrix-utils";
import { profile } from "../../screeps-typescript-profiler";

@profile
export class RoadPlan {
  private readonly roomw: RoomWrapper;
  public constructor(private readonly room: Room) {
    this.roomw = RoomWrapper.getInstance(room.name);
  }

  public placeRoadSourceContainersToControllerContainers(): ScreepsReturnCode {
    // console.log(`- container road planning`);

    const controllerContainers = this.roomw.controllerContainers;
    if (controllerContainers.length <= 0) {
      // console.log(` - no controller containers`);
      return OK;
    }

    const sourceContainers = this.roomw.sourceContainers;
    if (sourceContainers.length <= 0) {
      // console.log(` - no source containers`);
      return OK;
    }

    // get a path and place road for each pair of containers
    for (const sourceContainer of sourceContainers) {
      for (const controllerContainer of controllerContainers) {
        console.log(`DEBUG: place road source container to controller container`);
        const path: PathFinderPath = this.planRoad(sourceContainer.pos, controllerContainer.pos, 1);
        if (!path.incomplete) {
          this.placeRoadOnPath(path);
          // console.log(` - placement result: ${result}`);
        }
      }
    }
    return OK;
  }

  public placeRoadControllerToSpawn(): ScreepsReturnCode {
    let result: ScreepsReturnCode = ERR_NOT_FOUND;
    if (this.room.controller) {
      const spawns = this.room.find(FIND_MY_SPAWNS);
      if (spawns.length > 0) {
        console.log(`DEBUG: place road controller to spawn`);
        const path = this.planRoad(spawns[0].pos, this.room.controller.pos, 1);
        if (!path.incomplete) {
          result = this.placeRoadOnPath(path);
        }
      }
    }
    // CreepUtils.consoleLogIfWatched(this.room, `spawn road placement result`, result);
    return result;
  }

  private placeRoadOnPath(path: PathFinderPath): ScreepsReturnCode {
    for (const pos of path.path) {
      const hasRoad = this.checkForRoadAtPos(pos);
      if (!hasRoad) {
        const result = this.room.createConstructionSite(pos, STRUCTURE_ROAD);
        if (result !== 0) {
          // console.log(`road failed: ${result}, pos: ${String(pos)}`);
          return result;
        }
      }
    }
    return OK;
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

  public planRoad(origin: RoomPosition, goal: RoomPosition, range = 0): PathFinderPath {
    const path = PathFinder.search(
      origin,
      { pos: goal, range },
      { swampCost: 2, plainCost: 2, roomCallback: CostMatrixUtils.roadPlanningRoomCallback }
    );
    // console.log(`DEBUG: ${JSON.stringify(path)}`);
    if (path.incomplete) {
      // console.log(`road plan incomplete: ${String(origin)} -> ${String(goal)}`);
    }
    return path;
  }

  public placeRoadSpawnToExtensions(): ScreepsReturnCode {
    const extensions = this.room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_EXTENSION });
    const spawns = this.room.find(FIND_MY_SPAWNS);
    for (const spawn of spawns) {
      for (const extension of extensions) {
        const path = this.planRoad(spawn.pos, extension.pos, 1);
        if (!path.incomplete) {
          const result = this.placeRoadOnPath(path);
          if (result !== OK) {
            return result;
          }
        }
      }
    }
    return OK;
  }
}
