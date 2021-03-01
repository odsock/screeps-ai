import { CreepUtils } from "creep-utils";

export class RoadPlan {
  constructor(private readonly room: Room) { }

  public placeRoadSourceContainerToController(): ScreepsReturnCode {
    if (this.roomHasRoadsInConstruction()) {
      return OK;
    }

    const sourcesWithContainersWithoutRoads = this.room.find(FIND_SOURCES, {
      filter: (source) => {
        const sourceInfo = this.room.memory.sourceInfo[source.id];
        return sourceInfo.containerPos && !sourceInfo.controllerRoadComplete;
      }
    });
    
    const sourceContainers = sourcesWithContainersWithoutRoads.map((source) =>{
      const pos = this.room.memory.sourceInfo[source.id].containerPos as RoomPosition;
      return Object.create(RoomPosition.prototype, Object.getOwnPropertyDescriptors(pos));
    });

    if (sourceContainers[0]) {
      return this.placeRoadToController(sourceContainers[0]);
    }

    // Roads all placed
    return OK;
  }

  private placeRoadControllerToSpawn(): PathFinderPath | null {
    const controller = this.room.controller;
    if (controller) {
      const spawns = this.room.find(FIND_MY_SPAWNS);
      if (spawns.length > 0) {
        const path = this.planRoad(spawns[0].pos, controller.pos, 1)
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
      for (let i = 0; i < sources.length; i++) {
        const path = this.planRoad(sources[i].pos, controller.pos, 3);
        if (!path.incomplete) {
          this.placeRoadOnPath(path);
        }
      }
    }
    return OK;
  }

  private placeRoadOnPath(path: PathFinderPath): ScreepsReturnCode {
    for (let i = 0; i < path.path.length; i++) {
      const pos = path.path[i];
      const hasRoad = this.checkForRoadAtPos(pos);
      if (!hasRoad) {
        const result = this.room.createConstructionSite(pos, STRUCTURE_ROAD);
        if (result != 0) {
          console.log(`road failed: ${result}, pos: ${pos}`);
          return result;
        }
      }
    }
    return OK;
  }

  private checkForRoadAtPos(pos: RoomPosition): boolean {
    return pos.look().filter((item) => {
      const isRoad = item.structure?.structureType == STRUCTURE_ROAD;
      const isRoadSite = item.constructionSite?.structureType == STRUCTURE_ROAD;
      return isRoad || isRoadSite;
    }).length > 0;
  }

  private planRoad(origin: RoomPosition, goal: RoomPosition, range = 0): PathFinderPath {
    const path = PathFinder.search(origin, { pos: goal, range: range }, { swampCost: 2, plainCost: 2, roomCallback: CreepUtils.getRoadCostMatrix });
    if (path.incomplete) {
      console.log(`road plan incomplete: ${origin} -> ${goal}`);
    }
    return path;
  }

  private roomHasRoadsInConstruction(): boolean {
    return this.room.find(FIND_MY_CONSTRUCTION_SITES, {
      filter: (s) => s.structureType == STRUCTURE_ROAD
    }).length > 0;
  }
}