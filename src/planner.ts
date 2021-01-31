export class Planner {
  private readonly room: Room;

  public constructor(room: Room) {
    this.room = room;
  }

  public placeControllerRoads(): ScreepsReturnCode {
    if (this.room.controller && this.room.memory.controllerRoads?.complete != true) {
      let roads: RoadSet = { complete: true, paths: {} };
      const controller = this.room.controller;
      const sources = this.room.find(FIND_SOURCES);
      for (const source in sources) {
        const path = this.planRoad(sources[source].pos, controller.pos, 3)
        if (!path.incomplete) {
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

  public placeRoad(path: PathFinderPath): void {
    path.path.forEach((pos) => {
      const result = this.room.createConstructionSite(pos, STRUCTURE_ROAD);
      if (result != 0) {
        console.log(`road failed: ${result}, pos: ${pos}`);
      }
    });
  }

  public planRoad(origin: RoomPosition, goal: RoomPosition, range = 0): PathFinderPath {
    const path = PathFinder.search(origin, { pos: goal, range: range }, { swampCost: 2, plainCost: 2, roomCallback: this.getCostMatrix });
    this.room.visual.poly(path.path, { stroke: '#00ff00' });
    if (path.incomplete) {
      console.log(`road plan incomplete: ${origin} -> ${goal}`);
    }
    return path;
  }

  // TODO: plan roads around extensions
  public planExtensionRoads() {
    if (this.room.memory.extensionRoads != true) {
      console.log(`calling room: ${this.room.name}`);
      const extensions = this.room.find(FIND_MY_STRUCTURES, { filter: (s) => s.structureType == STRUCTURE_EXTENSION });
      const sources = this.room.find(FIND_SOURCES);
      for (const source in sources) {
        for (const extension in extensions) {
          const path = this.planRoad(sources[source].pos, extensions[extension].pos, 1);
          if (!path.incomplete) {
            this.placeRoad(path);
          }
        }
      }
      this.room.memory.extensionRoads = true;
    }
  }

  public getCostMatrix(roomName: string): CostMatrix | boolean {
    console.log(`roomName: ${roomName}`);
    const room = Game.rooms[roomName];
    if (!room) return false;
    let cost = new PathFinder.CostMatrix();
    room.find(FIND_STRUCTURES).forEach((s) => {
      if (s.structureType == STRUCTURE_ROAD) {
        cost.set(s.pos.x, s.pos.y, 1);
      }
      else if (s.structureType !== STRUCTURE_CONTAINER && (s.structureType !== STRUCTURE_RAMPART || !s.my)) {
        cost.set(s.pos.x, s.pos.y, 0xff);
      }
    });
    return cost;
  }

  // TODO: plan extension placement
}