import { CreepUtils } from "creep-utils";
import { RoomWrapper } from "structures/room-wrapper";

export class RoadPlan {
  private readonly roomw: RoomWrapper;
  public constructor(private readonly room: Room) {
    this.roomw = new RoomWrapper(room);
  }

  public placeRoadSourceContainerToControllerContainer(): ScreepsReturnCode {
    console.log(`- container road planning`);

    const controllerContainers = this.roomw.controllerContainers;
    if (controllerContainers.length <= 0) {
      console.log(` - no controller containers`);
      return OK;
    }

    const sourceContainers = this.roomw.sourceContainers;
    if (sourceContainers.length <= 0) {
      console.log(` - no source containers`);
      return OK;
    }

    // get a path and place road for each pair of containers
    for (const sourceContainer of sourceContainers) {
      for (const controllerContainer of controllerContainers) {
        const path: PathFinderPath = this.planRoad(sourceContainer.pos, controllerContainer.pos, 1);
        if (!path.incomplete) {
          const result = this.placeRoadOnPath(path);
          console.log(` - placement result: ${result}`);
        }
      }
    }
    return OK;
  }

  private placeRoadControllerToSpawn(): PathFinderPath | null {
    const controller = this.room.controller;
    if (controller) {
      const spawns = this.room.find(FIND_MY_SPAWNS);
      if (spawns.length > 0) {
        const path = this.planRoad(spawns[0].pos, controller.pos, 1);
        if (!path.incomplete) {
          this.placeRoadOnPath(path);
        }
        return path;
      }
    }
    return null;
  }

  private placeRoadToController(pos: RoomPosition): ScreepsReturnCode {
    const controller = this.room.controller;
    if (controller) {
      const roadPlanner = new RoadPlan(this.room);
      const path = roadPlanner.planRoad(pos, controller.pos, 1);
      if (!path.incomplete) {
        return roadPlanner.placeRoadOnPath(path);
      }
      return ERR_NO_PATH;
    }
    return OK;
  }

  private placeRoadsControllerToSources(): ScreepsReturnCode {
    const controller = this.room.controller;
    if (controller) {
      const sources = this.room.find(FIND_SOURCES);
      for (const source of sources) {
        const path = this.planRoad(source.pos, controller.pos, 3);
        if (!path.incomplete) {
          this.placeRoadOnPath(path);
        }
      }
    }
    return OK;
  }

  private placeRoadOnPath(path: PathFinderPath): ScreepsReturnCode {
    for (const pos of path.path) {
      const hasRoad = this.checkForRoadAtPos(pos);
      if (!hasRoad) {
        const result = this.room.createConstructionSite(pos, STRUCTURE_ROAD);
        if (result !== 0) {
          console.log(`road failed: ${result}, pos: ${String(pos)}`);
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

  private planRoad(origin: RoomPosition, goal: RoomPosition, range = 0): PathFinderPath {
    const path = PathFinder.search(
      origin,
      { pos: goal, range },
      { swampCost: 2, plainCost: 2, roomCallback: CreepUtils.getRoadCostMatrix }
    );
    if (path.incomplete) {
      console.log(`road plan incomplete: ${String(origin)} -> ${String(goal)}`);
    }
    return path;
  }

  private roomHasRoadsInConstruction(): boolean {
    return (
      this.room.find(FIND_MY_CONSTRUCTION_SITES, {
        filter: s => s.structureType === STRUCTURE_ROAD
      }).length > 0
    );
  }

  public placeExtensionRoads(): ScreepsReturnCode {
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
