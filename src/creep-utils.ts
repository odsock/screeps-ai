import { SockPuppetConstants } from "./config/sockpuppet-constants";

export interface Watchable {
  name: string;
  [key: string]: any;
  memory: { watched?: boolean; profile?: boolean };
}
import { profile } from "../screeps-typescript-profiler";

@profile
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

  public static getCreepMovementCostMatrix = (roomName: string): CostMatrix | boolean => {
    const cost = CreepUtils.getRoadCostMatrix(roomName);
    if (typeof cost === "boolean") return cost;

    const room = Game.rooms[roomName];
    if (!room) return false;

    // avoid creeps
    room.find(FIND_CREEPS).forEach(creep => cost.set(creep.pos.x, creep.pos.y, 0xff));
    return cost;
  };

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

  private static updateRoadCostMatrixForStructures(
    structures: AnyStructure[] | ConstructionSite[],
    cost: CostMatrix
  ): CostMatrix {
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
    return cost;
  }

  /** counts creep body parts matching specified type */
  public static countParts(type: BodyPartConstant, ...creeps: Creep[]): number {
    return creeps.reduce<number>((count, creep) => {
      return count + creep.body.filter(part => part.type === type).length;
    }, 0);
  }

  private static findCentroid = (
    centroid: { x: number; y: number },
    pos: RoomPosition,
    index: number,
    set: RoomPosition[]
  ): { x: number; y: number } => {
    centroid.x += pos.x / set.length;
    centroid.y += pos.y / set.length;
    return centroid;
  };
}
