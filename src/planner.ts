export class Planner {
  private readonly room: Room;

  public constructor(room: Room) {
    this.room = room;
  }

  public placeControllerRoads(): ScreepsReturnCode {
    if (this.room.controller && this.room.memory.controllerRoads?.complete != true) {
      let roads: RoadSet = {complete: true, paths: {}};
      const controller = this.room.controller;
      const sources = this.room.find(FIND_SOURCES);
      for (const source in sources) {
        const path = this.planRoad(sources[source].pos, controller.pos)
        if(!path.incomplete) {
          this.placeRoad(path);
          roads.paths[source] = path;
        }
        else {
          roads.complete = false;
        }
      }
      this.room.memory.controllerRoads = roads;
    }
    return OK;
  }

  public placeRoad(path: PathFinderPath): ScreepsReturnCode {
    for (const pos in path.path) {
      const result = this.room.createConstructionSite(path.path[pos], STRUCTURE_ROAD);
      if (result != 0) {
        console.log(`road failed: ${result}, pos: ${path.path[pos]}`);
        return result;
      }
    }
    return OK;
  }

  public planRoad(origin: RoomPosition, goal: RoomPosition): PathFinderPath {
    const path = PathFinder.search(origin, { pos: goal, range: 3 }, { swampCost: 1 });
    this.room.visual.poly(path.path, { stroke: '#00ff00' });
    if (path.incomplete) {
      console.log(`road plan incomplete: ${origin} -> ${goal}`);
    }
    return path;
  }

  // TODO: plan roads around extensions
  // TODO: plan extension placement
}