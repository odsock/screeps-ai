import { TargetControl } from "control/target-control";
import { MemoryUtils } from "planning/memory-utils";
import { RoomWrapper } from "structures/room-wrapper";

import { profile } from "../../screeps-typescript-profiler";
import { StructurePlanPosition } from "planning/structure-plan";
import { CreepUtils, LogLevel } from "creep-utils";

@profile
export class CostMatrixUtils {
  private static instance: CostMatrixUtils;
  private readonly targetControl: TargetControl;

  public constructor() {
    this.targetControl = TargetControl.getInstance();
  }

  public static getInstance(): CostMatrixUtils {
    this.instance = this.instance ?? new CostMatrixUtils();
    return this.instance;
  }

  private getCostMatrixFromCache(cacheKey: string): CostMatrix | undefined {
    const costMatrix = MemoryUtils.getCache<CostMatrix>(cacheKey);
    if (costMatrix) {
      return costMatrix;
    }
    return undefined;
  }

  private setCostMatrixInCache(cacheKey: string, costMatrix: CostMatrix): void {
    MemoryUtils.setCache(cacheKey, costMatrix);
  }

  /**
   * Avoid harvest positions and creeps.
   * Not cached.
   */
  public avoidHarvestPositionsAndCreepsCostCallback = (
    roomName: string,
    costMatrix: CostMatrix
  ): CostMatrix | void => {
    const updatedCostMatrix = this.avoidHarvestPositionsCostCallback(roomName, costMatrix);
    if (!updatedCostMatrix) {
      return;
    }
    const room = Game.rooms[roomName];
    if (!room) {
      return;
    }
    const roomw = RoomWrapper.getInstance(roomName);
    roomw.creeps.forEach(c => updatedCostMatrix.set(c.pos.x, c.pos.y, 0xff));
    return updatedCostMatrix;
  };

  /**
   * Avoid harvest positions.
   * Cached.
   */
  public avoidHarvestPositionsCostCallback = (
    roomName: string,
    costMatrix: CostMatrix
  ): CostMatrix | void => {
    const cacheKey = `${roomName}_avoidHarvestPositions`;
    const cachedCostMatrix = this.getCostMatrixFromCache(cacheKey);
    if (cachedCostMatrix) {
      return cachedCostMatrix;
    }
    const room = Game.rooms[roomName];
    if (!room) {
      return;
    }
    const roomw = RoomWrapper.getInstance(roomName);
    roomw.sources.forEach(source =>
      roomw.getHarvestPositions(source.id).forEach(pos => costMatrix.set(pos.x, pos.y, 0xff))
    );
    this.setCostMatrixInCache(cacheKey, costMatrix);
    return costMatrix;
  };

  /**
   * Avoid harvest positions, and roads near the controller.
   * Used by upgraders deciding where to stand.
   * Cached for repeated use.
   */
  public avoidHarvestPositionsAndRoadsNearControllerCostCallback = (
    roomName: string,
    costMatrix: CostMatrix
  ): CostMatrix | void => {
    const cacheKey = "avoidHarvestPositionsAndRoadsNearController";
    const cachedCostMatrix = this.getCostMatrixFromCache(cacheKey);
    if (cachedCostMatrix) {
      return cachedCostMatrix;
    }

    const updatedCostMatrix = this.avoidHarvestPositionsCostCallback(roomName, costMatrix);
    if (!updatedCostMatrix) {
      return;
    }
    const room = Game.rooms[roomName];
    if (!room) {
      return;
    }
    const roomw = RoomWrapper.getInstance(roomName);
    if (roomw.controller) {
      const conPos = roomw.controller.pos;
      const top = conPos.y - 3;
      const left = conPos.x - 3;
      const bottom = conPos.y + 3;
      const right = conPos.x + 3;
      roomw
        .lookForAtArea(LOOK_STRUCTURES, top, left, bottom, right, true)
        .filter(s => s.structure.structureType === STRUCTURE_ROAD)
        .forEach(road => updatedCostMatrix.set(road.x, road.y, 0xff));
    }
    this.setCostMatrixInCache(cacheKey, updatedCostMatrix);
    return updatedCostMatrix;
  };

  /**
   * Sets roads to 1, unwalkable structures and unwalkable construction sites to 255
   */
  public structuresCostCallback = (roomName: string, costMatrix: CostMatrix): CostMatrix | void => {
    const room = Game.rooms[roomName];
    if (!room) {
      return;
    }
    const roomw = RoomWrapper.getInstance(roomName);
    const structures = roomw.find(FIND_STRUCTURES);
    for (const structure of structures) {
      if (structure.structureType === STRUCTURE_ROAD) {
        costMatrix.set(structure.pos.x, structure.pos.y, 1);
      } else if (
        structure.structureType !== STRUCTURE_CONTAINER &&
        (structure.structureType !== STRUCTURE_RAMPART || !structure.my)
      ) {
        costMatrix.set(structure.pos.x, structure.pos.y, 0xff);
      }
    }

    const constructionSites = roomw.find(FIND_CONSTRUCTION_SITES);
    for (const structure of constructionSites) {
      if (
        structure.structureType !== STRUCTURE_CONTAINER &&
        structure.structureType !== STRUCTURE_ROAD &&
        (structure.structureType !== STRUCTURE_RAMPART || !structure.my)
      ) {
        costMatrix.set(structure.pos.x, structure.pos.y, 0xff);
      }
    }

    return costMatrix;
  };

  /**
   * Creep movement prefering roads>plains>swamps, avoiding unwalkable areas.
   */
  public creepMovementCostCallback = (
    roomName: string,
    costMatrix: CostMatrix
  ): CostMatrix | void => {
    const room = Game.rooms[roomName];
    if (!room || this.targetControl.isForbiddenRoom(roomName)) {
      return;
    }
    const updatedCostMatrix = this.structuresCostCallback(roomName, costMatrix);
    if (!updatedCostMatrix) {
      return;
    }
    room.find(FIND_CREEPS).forEach(creep => updatedCostMatrix.set(creep.pos.x, creep.pos.y, 0xff));
    return updatedCostMatrix;
  };

  /** *****************************************************
   * Room Callbacks
   */

  /**
   * Plan path to prefer attaching to existing roads and roads in construction.
   * Avoid unwalkable structures, harvest positions, and containers.
   * Does not cache result, since not called often.
   */
  public roadPlanningRoomCallback = (roomName: string): CostMatrix | boolean => {
    const room = Game.rooms[roomName];
    if (!room || this.targetControl.isForbiddenRoom(roomName)) {
      return false;
    }
    const costMatrix = this.avoidHarvestPositionsCostCallback(
      roomName,
      new PathFinder.CostMatrix()
    );
    if (!costMatrix) {
      return false;
    }

    // plan roads around planned structures
    const plan = MemoryUtils.getCache<StructurePlanPosition[]>(`${roomName}_plan`);
    if (!plan) {
      CreepUtils.log(LogLevel.ERROR, `attempting road planning with no plan`);
    } else {
      plan.forEach(pos => {
        if (pos.structure === STRUCTURE_ROAD) {
          costMatrix.set(pos.pos.x, pos.pos.y, 1);
        } else if (pos.structure !== STRUCTURE_RAMPART) {
          costMatrix.set(pos.pos.x, pos.pos.y, 0xff);
        }
      });
    }

    return costMatrix;
  };

  /**
   * Creep movement prefering roads>plains>swamps, avoiding unwalkable areas.
   */
  public creepMovementRoomCallback = (roomName: string): CostMatrix | boolean => {
    const room = Game.rooms[roomName];
    if (!room || this.targetControl.isForbiddenRoom(roomName)) {
      return false;
    }
    const costMatrix = this.structuresCostCallback(roomName, new PathFinder.CostMatrix());
    if (!costMatrix) {
      return false;
    }
    room.find(FIND_CREEPS).forEach(creep => costMatrix.set(creep.pos.x, creep.pos.y, 0xff));
    return costMatrix;
  };

  /**
   * Prefer roads, avoid unwalkable structures
   */
  public structuresRoomCallback = (roomName: string): CostMatrix | boolean => {
    const roomw = Game.rooms[roomName];
    if (!roomw) {
      return false;
    }
    const updatedCostMatrix = this.structuresCostCallback(roomName, new PathFinder.CostMatrix());
    if (!updatedCostMatrix) {
      return false;
    }
    return updatedCostMatrix;
  };
}
