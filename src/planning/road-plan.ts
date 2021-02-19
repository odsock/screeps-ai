import { CreepUtils } from "creep-utils";

export class RoadPlan {
  constructor(private readonly room: Room) { }

  public placeRoadControllerToSpawn(): PathFinderPath | null {
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

  public placeRoadsControllerToSources(): ScreepsReturnCode {
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

  public placeRoadOnPath(path: PathFinderPath): ScreepsReturnCode {
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

  public planRoad(origin: RoomPosition, goal: RoomPosition, range = 0): PathFinderPath {
    const path = PathFinder.search(origin, { pos: goal, range: range }, { swampCost: 2, plainCost: 2, roomCallback: CreepUtils.getRoadCostMatrix });
    if (path.incomplete) {
      console.log(`road plan incomplete: ${origin} -> ${goal}`);
    }
    return path;
  }
}