import { SockPuppetConstants } from "./config/sockpuppet-constants";

export class CreepUtils {
  public static consoleLogIfWatched(
    watchable: Watchable,
    message: string,
    result: ScreepsReturnCode | undefined = undefined
  ): void {
    if (watchable.memory.watched === true) {
      if (result !== undefined) {
        const resultString = String(SockPuppetConstants.ERROR_CODE_LOOKUP.get(result));
        console.log(`${watchable.name}: ${message}: ${result} ${resultString}`);
      } else {
        console.log(`${watchable.name}: ${message}`);
      }
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

  public static getRoadCostMatrix = (roomName: string): CostMatrix | boolean => {
    const room = Game.rooms[roomName];
    if (!room) return false;
    const cost = new PathFinder.CostMatrix();

    const structures = room.find(FIND_STRUCTURES);
    CreepUtils.updateRoadCostMatrixForStructures(structures, cost);

    const constructionSites = room.find(FIND_CONSTRUCTION_SITES);
    CreepUtils.updateRoadCostMatrixForStructures(constructionSites, cost);

    return cost;
  };

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

  /** counts creep body parts matching specified type */
  public static countParts(type: BodyPartConstant, ...creeps: Creep[]): number {
    return creeps.reduce<number>((count, creep) => {
      return count + creep.body.filter(part => part.type === type).length;
    }, 0);
  }

  /** Calculates the Hausdorff distance between two sets of positions */
  public static calculatePositionSetDistance(setA: RoomPosition[], setB: RoomPosition[]): number {
    console.log(`hausdorff: ${setA.toString()}, ${setB.toString()}`);
    let xRangeMax = 0;
    const yRangeMax = 0;
    setA.forEach(posA => {
      setB.forEach(posB => {
        const xRange = Math.abs(posA.x - posB.x);
        if (xRange > xRangeMax) {
          xRangeMax = xRange;
        }
        const yRange = Math.abs(posA.x - posB.x);
        if (yRange > yRangeMax) {
          xRangeMax = yRange;
        }
      });
    });
    const result = Math.sqrt(Math.pow(xRangeMax, 2) + Math.pow(yRangeMax, 2));
    console.log(`result: ${result}`);
    return result;
  }
}
