export class CreepUtils {
  public static consoleLogIfWatched(watchable: Watchable, message: string): void {
    if (watchable.memory.watched === true) {
      console.log(`${watchable.name}: ${message}`);
    }
  }

  public static creepBodyToString(body: BodyPartConstant[]): string {
    const counts = _.countBy(body);
    let returnValue = "";
    for (const key in counts) {
      returnValue = `${returnValue}${key[0]}${counts[key]}`;
    }
    return returnValue;
  }

  public static getEnergyStoreRatioFree(structure: StructureWithStorage): number {
    const freeCap = structure.store.getFreeCapacity(RESOURCE_ENERGY);
    const totalCap = structure.store.getCapacity(RESOURCE_ENERGY);
    if (freeCap && totalCap) {
      return freeCap / totalCap;
    } else {
      return 0;
    }
  }

  public static getPath(origin: RoomPosition, goal: RoomPosition): PathFinderPath {
    return PathFinder.search(
      origin,
      { pos: goal, range: 1 },
      {
        plainCost: 2,
        swampCost: 10,
        roomCallback: this.getRoadCostMatrix
      }
    );
  }

  public static getRoadCostMatrix(roomName: string): CostMatrix | boolean {
    const room = Game.rooms[roomName];
    if (!room) return false;
    const cost = new PathFinder.CostMatrix();

    const structures = room.find(FIND_STRUCTURES);
    CreepUtils.updateRoadCostMatrixForStructures(structures, cost);

    const constructionSites = room.find(FIND_CONSTRUCTION_SITES);
    CreepUtils.updateRoadCostMatrixForStructures(constructionSites, cost);

    return cost;
  }

  private static updateRoadCostMatrixForStructures(structures: AnyStructure[] | ConstructionSite[], cost: CostMatrix) {
    for (const structure of structures) {
      if (structure.structureType === STRUCTURE_ROAD) {
        cost.set(structure.pos.x, structure.pos.y, 1);
      } else if (
        structure.structureType !== STRUCTURE_CONTAINER &&
        (structure.structureType !== STRUCTURE_RAMPART || !structure.my)
      ) {
        cost.set(structure.pos.x, structure.pos.y, 0xff);
      }
    }
  }
}
