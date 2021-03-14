export class CreepUtils {
  public static consoleLogIfWatched(watchable: Watchable, message: string) {
    if (watchable.memory.watched == true) {
      console.log(`${watchable.name}: ${message}`);
    }
  }

  public static getEnergyStoreRatioFree(structure: StructureWithStorage): number {
    const freeCap = structure.store.getFreeCapacity(RESOURCE_ENERGY);
    const totalCap = structure.store.getCapacity(RESOURCE_ENERGY);
    if (freeCap && totalCap) {
      return freeCap / totalCap;
    }
    else {
      return 0;
    }
  }

  public static getPath(origin: RoomPosition, goal: RoomPosition): PathFinderPath {
    return PathFinder.search(origin, { pos: goal, range: 1 }, {
      plainCost: 2,
      swampCost: 10,
      roomCallback: this.getRoadCostMatrix
    });
  }

  public static getRoadCostMatrix(roomName: string): CostMatrix | boolean {
    const room = Game.rooms[roomName];
    if (!room) return false;
    let cost = new PathFinder.CostMatrix();

    const structures = room.find(FIND_STRUCTURES);
    CreepUtils.updateRoadCostMatrixForStructures(structures, cost);

    const constructionSites = room.find(FIND_CONSTRUCTION_SITES);
    CreepUtils.updateRoadCostMatrixForStructures(constructionSites, cost);

    return cost;
  }

  private static updateRoadCostMatrixForStructures(structures: AnyStructure[] | ConstructionSite[], cost: CostMatrix) {
    for (let i = 0; i < structures.length; i++) {
      const structure = structures[i];
      if (structure.structureType == STRUCTURE_ROAD) {
        cost.set(structure.pos.x, structure.pos.y, 1);
      }
      else if (structure.structureType !== STRUCTURE_CONTAINER && (structure.structureType !== STRUCTURE_RAMPART || !structure.my)) {
        cost.set(structure.pos.x, structure.pos.y, 0xff);
      }
    }
  }
}
