import { MemoryUtils } from "planning/memory-utils";
import { RoomWrapper } from "structures/room-wrapper";

export class CostMatrixUtils {
  private static getCostMatrixFromCache(name: string): CostMatrix | undefined {
    const cacheKey = `${this.name}_${name}`;
    const costMatrix = MemoryUtils.getCache<CostMatrix>(cacheKey);
    if (costMatrix) {
      return costMatrix;
    }
    return undefined;
  }

  private static setCostMatrixInCache(name: string, costMatrix: CostMatrix): void {
    const cacheKey = `${this.name}_${name}`;
    MemoryUtils.setCache(cacheKey, costMatrix, 100);
  }

  /**
   * Avoid harvest positions.
   * Cached.
   */
  public static avoidHarvestPositionsCostCallback = (roomName: string, costMatrix: CostMatrix): CostMatrix => {
    const cacheKey = "avoidHarvestPositions";
    const cachedCostMatrix = CostMatrixUtils.getCostMatrixFromCache(cacheKey);
    if (cachedCostMatrix) {
      return cachedCostMatrix;
    }

    const roomw = RoomWrapper.getInstance(roomName);
    roomw.sources.forEach(source =>
      roomw.getHarvestPositions(source.id).forEach(pos => costMatrix.set(pos.x, pos.y, 0xff))
    );
    CostMatrixUtils.setCostMatrixInCache(cacheKey, costMatrix);
    return costMatrix;
  };

  /**
   * Avoid harvest positions, and roads near the controller.
   * Used by upgraders deciding where to stand.
   * Cached for repeated use.
   */
  public static avoidHarvestPositionsAndRoadsNearControllerCostCallback = (
    roomName: string,
    costMatrix: CostMatrix
  ): CostMatrix => {
    const cacheKey = "avoidHarvestPositionsAndRoadsNearController";
    const cachedCostMatrix = CostMatrixUtils.getCostMatrixFromCache(cacheKey);
    if (cachedCostMatrix) {
      return cachedCostMatrix;
    }

    const roomw = RoomWrapper.getInstance(roomName);
    roomw.sources.forEach(source =>
      roomw.getHarvestPositions(source.id).forEach(pos => costMatrix.set(pos.x, pos.y, 0xff))
    );
    if (roomw.controller) {
      const conPos = roomw.controller.pos;
      const top = conPos.y - 3;
      const left = conPos.x - 3;
      const bottom = conPos.y + 3;
      const right = conPos.x + 3;
      roomw
        .lookForAtArea(LOOK_STRUCTURES, top, left, bottom, right, true)
        .filter(s => s.structure.structureType === STRUCTURE_ROAD)
        .forEach(road => costMatrix.set(road.x, road.y, 0xff));
    }
    CostMatrixUtils.setCostMatrixInCache(cacheKey, costMatrix);
    return costMatrix;
  };

  /**
   * Plan path to prefer attaching to existing or in construction roads.
   * Avoid unwalkable structures, harvest positions, and containers.
   * Does not cache result, since not called often.
   */
  public static roadPlanningRoomCallback = (roomName: string): CostMatrix | boolean => {
    const roomw = RoomWrapper.getInstance(roomName);
    if (!roomw) {
      return false;
    }

    const cost = new PathFinder.CostMatrix();

    const structures = roomw.find(FIND_STRUCTURES);
    const constructionSites = roomw.find(FIND_CONSTRUCTION_SITES);
    for (const structure of [...structures, ...constructionSites]) {
      if (structure.structureType === STRUCTURE_ROAD) {
        cost.set(structure.pos.x, structure.pos.y, 1);
      } else if (structure.structureType !== STRUCTURE_RAMPART || !structure.my) {
        cost.set(structure.pos.x, structure.pos.y, 0xff);
      }
    }

    return CostMatrixUtils.avoidHarvestPositionsCostCallback(roomName, cost);
  };

  /**
   * Creep movement prefering roads>plains>swamps, avoiding unwalkable areas.
   */
  public static getCreepMovementCostMatrix = (roomName: string): CostMatrix | boolean => {
    const cacheKey = "creepMovement";
    const cachedCostMatrix = CostMatrixUtils.getCostMatrixFromCache(cacheKey);
    if (cachedCostMatrix) {
      return cachedCostMatrix;
    }

    const cost = CostMatrixUtils.getRoadCostMatrix(roomName);
    if (typeof cost === "boolean") return cost;

    const room = Game.rooms[roomName];
    if (!room) return false;

    // avoid creeps
    room.find(FIND_CREEPS).forEach(creep => cost.set(creep.pos.x, creep.pos.y, 0xff));
    CostMatrixUtils.setCostMatrixInCache(cacheKey, cost);
    return cost;
  };

  private static getRoadCostMatrix = (roomName: string): CostMatrix | boolean => {
    const roomw = RoomWrapper.getInstance(roomName);
    if (!roomw) {
      return false;
    }

    const cost = new PathFinder.CostMatrix();

    const structures = roomw.find(FIND_STRUCTURES);
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

    const constructionSites = roomw.find(FIND_CONSTRUCTION_SITES);
    for (const structure of [...structures, ...constructionSites]) {
      if (
        structure.structureType !== STRUCTURE_CONTAINER &&
        structure.structureType !== STRUCTURE_ROAD &&
        (structure.structureType !== STRUCTURE_RAMPART || !structure.my)
      ) {
        cost.set(structure.pos.x, structure.pos.y, 0xff);
      }
    }

    return cost;
  };
}
