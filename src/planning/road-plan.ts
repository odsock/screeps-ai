import { CreepUtils } from "creep-utils";

export class RoadPlan {
  public constructor(private readonly room: Room) {}

  // TODO: make this a road to the controller container
  public placeRoadSourceContainerToControllerContainer(): ScreepsReturnCode {
    console.log(`- container road planning`);
    // if (this.roomHasRoadsInConstruction()) {
    //   console.log(` - roads already in construction`);
    //   return ERR_BUSY;
    // }

    const controllerContainer = Game.getObjectById(
      this.room.memory.controllerInfo.containerId as Id<StructureContainer>
    );
    if (!controllerContainer) {
      console.log(` - no controller container`);
      this.room.memory.controllerInfo.containerId = undefined;
      return ERR_NOT_FOUND;
    }

    const sourceInfo = this.room.memory.sourceInfo;
    for (const sourceId in sourceInfo) {
      const info = sourceInfo[sourceId];

      // get the container object, clear id memory if not found
      const sourceContainer = Game.getObjectById(info.containerId as Id<StructureContainer>);
      if (!sourceContainer) {
        this.room.memory.sourceInfo[sourceId].containerId = undefined;
        continue;
      }

      // get a path and place road idempotently
      const path: PathFinderPath = this.planRoad(sourceContainer?.pos, controllerContainer.pos, 1);
      if (!path.incomplete) {
        const result = this.placeRoadOnPath(path);
        console.log(` - placement result: ${result}`);
        // if (this.roomHasRoadsInConstruction()) {
        //   return OK;
        // }
      }
    }

    // no sources, or no containers
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
}
