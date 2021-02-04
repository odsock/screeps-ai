export class RoadPlan {
  constructor(private readonly room: Room) { }

  public placeControllerRoad(pos: RoomPosition): void {
    const controller = this.room.controller;
    if (controller) {
      const path = this.planRoad(pos, controller.pos, 3)
      if (!path.incomplete) {
        this.placeRoadOnPath(path);
      }
    }
  }

  public placeControllerRoads(): ScreepsReturnCode {
    if (this.room.controller && this.room.memory.controllerRoads != true) {
      this.room.memory.controllerRoads = true;
      const controller = this.room.controller;
      const sources = this.room.find(FIND_SOURCES);
      for (let i = 0; i < sources.length; i++) {
        const path = this.planRoad(sources[i].pos, controller.pos, 3)
        if (!path.incomplete) {
          this.placeRoadOnPath(path);
        }
        else {
          this.room.memory.controllerRoads = false;
        }
      }
    }
    return OK;
  }

  public placeRoadOnPath(path: PathFinderPath): void {
    for (let i = 0; i < path.path.length; i++) {
      const pos = path.path[i];
      const hasRoad = this.checkForRoadAtPos(pos);
      if (!hasRoad) {
        const result = this.room.createConstructionSite(pos, STRUCTURE_ROAD);
        if (result != 0) {
          console.log(`road failed: ${result}, pos: ${pos}`);
          break;
        }
      }
    }
  }

  private checkForRoadAtPos(pos: RoomPosition) {
    return pos.look().filter((item) => {
      const isRoad = item.structure?.structureType == STRUCTURE_ROAD;
      const isRoadSite = item.constructionSite?.structureType == STRUCTURE_ROAD;
      return isRoad || isRoadSite;
    }).length > 0;
  }

  public planRoad(origin: RoomPosition, goal: RoomPosition, range = 0): PathFinderPath {
    const path = PathFinder.search(origin, { pos: goal, range: range }, { swampCost: 2, plainCost: 2, roomCallback: this.getCostMatrix });
    if (path.incomplete) {
      console.log(`road plan incomplete: ${origin} -> ${goal}`);
    }
    return path;
  }

  public getCostMatrix(roomName: string): CostMatrix | boolean {
    const room = Game.rooms[roomName];
    if (!room) return false;
    let cost = new PathFinder.CostMatrix();

    const structures = room.find(FIND_STRUCTURES);
    for (let i = 0; i < structures.length; i++) {
      const structure = structures[i];
      if (structure.structureType == STRUCTURE_ROAD) {
        cost.set(structure.pos.x, structure.pos.y, 1);
      }
      else if (structure.structureType !== STRUCTURE_CONTAINER && (structure.structureType !== STRUCTURE_RAMPART || !structure.my)) {
        cost.set(structure.pos.x, structure.pos.y, 0xff);
      }
    }

    const constructionSites = room.find(FIND_CONSTRUCTION_SITES);
    for (let i = 0; i < constructionSites.length; i++) {
      const site = constructionSites[i];
      if (site.structureType == STRUCTURE_ROAD) {
        cost.set(site.pos.x, site.pos.y, 1);
      }
      else if (site.structureType !== STRUCTURE_CONTAINER && (site.structureType !== STRUCTURE_RAMPART || !site.my)) {
        cost.set(site.pos.x, site.pos.y, 0xff);
      }
    }

    return cost;
  }
}