import { Constants } from "../constants";
import { MemoryUtils } from "planning/memory-utils";
import { PlannerUtils } from "planning/planner-utils";
import { SpawnWrapper } from "./spawn-wrapper";
import { TargetConfig } from "target-config";
import { CreepUtils } from "creep-utils";

// TODO: figure out how to make a singleton for each room
export class RoomWrapper extends Room {
  public constructor(private readonly room: Room) {
    super(room.name);
  }

  /** Declare getters for properties that don't seem to get copied in when constructed */

  public get controller(): StructureController | undefined {
    return this.room.controller;
  }

  public get energyAvailable(): number {
    return this.room.energyAvailable;
  }

  public get energyCapacityAvailable(): number {
    return this.room.energyCapacityAvailable;
  }

  public get mode(): string {
    return this.room.mode;
  }

  public get storage(): StructureStorage | undefined {
    return this.room.storage;
  }

  public get terminal(): StructureTerminal | undefined {
    return this.room.terminal;
  }

  /** Getters for some cached properties */

  public get hasHostiles(): boolean {
    return this.hostileCreeps.length > 0;
  }
  public get hostileCreeps(): Creep[] {
    return this.room.find(FIND_HOSTILE_CREEPS);
  }

  public get creeps(): Creep[] {
    return this.room.find(FIND_MY_CREEPS);
  }

  public get deposits(): Deposit[] {
    return this.room.find(FIND_DEPOSITS);
  }

  public get spawns(): SpawnWrapper[] {
    return this.room.find(FIND_MY_SPAWNS).map(spawn => new SpawnWrapper(spawn));
  }

  /**
   * Structures marked for demolition.
   */
  public get dismantleQueue(): Structure[] {
    let queue = MemoryUtils.getCache<Structure[]>(`${this.room.name}_dismantleQueue`);
    if (!queue) {
      MemoryUtils.setCache(`${this.room.name}_dismantleQueue`, [], Constants.PLANNING_INTERVAL);
      return [];
    }
    queue = queue.filter(structure => !!Game.getObjectById(structure.id));
    MemoryUtils.setCache(`${this.room.name}_dismantleQueue`, queue, Constants.PLANNING_INTERVAL);
    return queue;
  }

  /**
   * Room remote harvest queue.
   */
  public get remoteQueue(): ClaimCount[] {
    let queue = MemoryUtils.getCache<ClaimCount[]>(`${this.room.name}_remoteQueue`);
    if (!queue) {
      queue = TargetConfig.REMOTE_HARVEST[Game.shard.name]
        .filter(name => !Game.rooms[name].controller?.my)
        .map(name => {
          return { name, count: 0 } as ClaimCount;
        });
    }
    queue = queue.filter(claim => !Game.rooms[claim.name].controller?.my);
    MemoryUtils.setCache(`${this.room.name}_remoteQueue`, queue, 1000);
    return queue;
  }

  /**
   * update remote queue
   */
  public set remoteQueue(queue: ClaimCount[]) {
    MemoryUtils.setCache(`${this.room.name}_remoteQueue`, queue, 1000);
  }

  /** get target room from queue */
  public getRoomRemote(): string | undefined {
    CreepUtils.consoleLogIfWatched(this, `getting remote from queue`);
    const index = this.remoteQueue.findIndex(claim => claim.count < TargetConfig.IMPORTERS_PER_REMOTE_ROOM);
    if (index !== -1) {
      const claim = this.remoteQueue[index];
      CreepUtils.consoleLogIfWatched(this, `found ${String(claim)}`);
      this.remoteQueue[index] = { name: claim.name, count: claim.count++ };
      return claim.name;
    }
    return undefined;
  }

  /** release target room to queue */
  public releaseRoomRemote(name: string): void {
    const index = this.remoteQueue.findIndex(claim => claim.name === name);
    if (index !== -1) {
      const claim = this.remoteQueue[index];
      const newCount = claim.count > 0 ? claim.count-- : 0;
      this.remoteQueue[index] = { name: claim.name, count: newCount };
    }
  }

  /**
   * Room claim/reserve queue.
   */
  public get claimQueue(): string[] {
    let queue = MemoryUtils.getCache<string[]>(`${this.room.name}_claimQueue`);
    if (!queue) {
      queue = TargetConfig.TARGETS[Game.shard.name];
      queue.concat(TargetConfig.REMOTE_HARVEST[Game.shard.name]);
    }
    queue.filter(name => !Game.rooms[name].controller?.my);
    MemoryUtils.setCache(`${this.room.name}_claimQueue`, queue, 1000);
    return queue;
  }

  /**
   * update claim queue
   */
  public set claimQueue(queue: string[]) {
    MemoryUtils.setCache(`${this.room.name}_claimQueue`, queue, 1000);
  }

  /** get target room from queue */
  public getRoomClaim(): string | undefined {
    const queue = this.claimQueue;
    const name = queue.pop();
    this.claimQueue = queue;
    return name;
  }

  /** release target room to queue */
  public releaseRoomClaim(name: string): void {
    const queue = this.claimQueue;
    queue.push(name);
    this.claimQueue = queue;
  }

  /**
   * Cached string export of colony plan visual.
   */
  public get planVisual(): string {
    const visual = MemoryUtils.getCache<string>(`${this.room.name}_planVisual`);
    if (visual) {
      return visual;
    }
    return "";
  }

  /**
   * Sets cached string export of colony plan visual.
   */
  public set planVisual(visual: string) {
    MemoryUtils.setCache(`${this.room.name}_planVisual`, visual, Constants.PLANNING_INTERVAL);
  }

  /**
   * Cached string export of demolition plan visual.
   */
  public get dismantleVisual(): string {
    const visual = MemoryUtils.getCache<string>(`${this.room.name}_dismantleVisual`);
    if (visual) {
      return visual;
    }
    return "";
  }

  /**
   * Sets cached string export of demolition plan visual.
   */
  public set dismantleVisual(visual: string) {
    MemoryUtils.setCache(`${this.room.name}_dismantleVisual`, visual, Constants.PLANNING_INTERVAL);
  }

  /**
   * Gets sources in room by calling find.
   */
  public get sources(): Source[] {
    return this.room.find(FIND_SOURCES);
  }

  /** stuff that needs caching code */

  public get constructionWork(): number {
    return this.myConstructionSites.reduce<number>((work: number, site) => {
      return work + site.progressTotal - site.progress;
    }, 0);
  }

  public get myConstructionSites(): ConstructionSite[] {
    return this.room.find(FIND_MY_CONSTRUCTION_SITES);
  }

  public get constructionSites(): ConstructionSite[] {
    return this.room.find(FIND_CONSTRUCTION_SITES);
  }

  public get towers(): StructureTower[] {
    return this.room.find(FIND_MY_STRUCTURES, {
      filter: structure => structure.structureType === STRUCTURE_TOWER
    }) as StructureTower[];
  }

  public get repairSites(): AnyStructure[] {
    return this.room.find(FIND_STRUCTURES, { filter: structure => structure.hits < structure.hitsMax });
  }

  public get sourceContainers(): StructureContainer[] {
    return this.room.memory.containers.reduce<StructureContainer[]>((list: StructureContainer[], containerInfo) => {
      if (containerInfo.nearSource) {
        const container = Game.getObjectById(containerInfo.containerId as Id<StructureContainer>);
        if (container !== null) {
          list.push(container);
        }
      }
      return list;
    }, []);
  }

  public get controllerContainers(): StructureContainer[] {
    return this.room.memory.containers.reduce<StructureContainer[]>((list: StructureContainer[], containerInfo) => {
      if (containerInfo.nearController) {
        const container = Game.getObjectById(containerInfo.containerId as Id<StructureContainer>);
        if (container !== null) {
          list.push(container);
        }
      }
      return list;
    }, []);
  }

  /** writes events to memory */

  public roomMemoryLog(message: string): void {
    if (!this.room.memory.log) {
      this.room.memory.log = [];
    }
    this.room.memory.log.push(`${Game.time}: ${message}`);
  }

  /** Harvest positions caching */

  private harvestPositionsCache: RoomPosition[] | undefined;

  public get harvestPositions(): RoomPosition[] {
    if (this.harvestPositionsCache) {
      return this.harvestPositionsCache;
    } else if (this.room.memory.harvestPositions) {
      this.harvestPositionsCache = this.room.memory.harvestPositions.map(pos => MemoryUtils.unpackRoomPosition(pos));
    } else {
      this.harvestPositionsCache = this.findHarvestPositions();
      this.room.memory.harvestPositions = this.harvestPositionsCache.map(pos => MemoryUtils.packRoomPosition(pos));
    }
    return this.harvestPositionsCache;
  }

  private findHarvestPositions(): RoomPosition[] {
    return this.sources
      .reduce<RoomPosition[]>((positions: RoomPosition[], source) => {
        return positions.concat(PlannerUtils.getPositionSpiral(source.pos, 1));
      }, [])
      .filter(pos => PlannerUtils.isEnterable(pos));
  }

  /** cost matrix caching */

  private costMatrixCache: { [name: string]: CostMatrix } = {};

  public getCostMatrix(name: string, costMatrix: CostMatrix): CostMatrix {
    if (!this.room.memory.costMatrix) {
      this.room.memory.costMatrix = {};
    }

    if (this.costMatrixCache[name]) {
      return this.costMatrixCache[name];
    } else if (this.room.memory.costMatrix[name]) {
      this.costMatrixCache[name] = PathFinder.CostMatrix.deserialize(this.room.memory.costMatrix[name]);
    } else {
      switch (name) {
        case "avoidHarvestPositions":
          this.harvestPositions.forEach(pos => costMatrix.set(pos.x, pos.y, 0xff));
          break;

        default:
          throw new Error(`Unknown cost matrix ${name}`);
      }
      this.costMatrixCache[name] = costMatrix;
      this.room.memory.costMatrix[name] = costMatrix.serialize();
    }
    return costMatrix;
  }

  /** various find methods */

  public findClosestDamagedNonRoad(pos: RoomPosition): AnyStructure | null {
    return pos.findClosestByRange(FIND_STRUCTURES, {
      filter: structure =>
        structure.hits < structure.hitsMax &&
        structure.structureType !== STRUCTURE_ROAD &&
        structure.structureType !== STRUCTURE_WALL &&
        !this.dismantleQueue.find(dismantle => dismantle.id === structure.id)
    });
  }

  public findClosestDamagedRoad(pos: RoomPosition): StructureRoad | null {
    return pos.findClosestByRange<StructureRoad>(FIND_STRUCTURES, {
      filter: structure =>
        structure.hits < structure.hitsMax &&
        structure.structureType === STRUCTURE_ROAD &&
        !this.dismantleQueue.find(dismantle => dismantle.id === structure.id)
    });
  }

  public findWeakestWall(): StructureWall | null {
    const wallsToRepair = this.room.find<StructureWall>(FIND_STRUCTURES, {
      filter: structure =>
        structure.hits < Constants.MAX_HITS_WALL &&
        (structure.structureType === STRUCTURE_WALL || structure.structureType === STRUCTURE_RAMPART) &&
        !this.dismantleQueue.find(dismantle => dismantle.id === structure.id)
    });

    if (wallsToRepair.length > 0) {
      return wallsToRepair.reduce((weakestWall, wall) => {
        return weakestWall.hits < wall.hits ? weakestWall : wall;
      });
    } else {
      return null;
    }
  }
}
