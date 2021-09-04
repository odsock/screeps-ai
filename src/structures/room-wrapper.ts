import { SockPuppetConstants } from "../config/sockpuppet-constants";
import { MemoryUtils } from "planning/memory-utils";
import { PlannerUtils } from "planning/planner-utils";
import { SpawnWrapper } from "./spawn-wrapper";
import { TargetConfig } from "config/target-config";
import { CreepUtils } from "creep-utils";
import { Queue } from "planning/queue";
import { RoomClaim } from "planning/room-claim";

// TODO: figure out how to make a singleton for each room
export class RoomWrapper extends Room {
  private readonly remoteQueueStore: Queue<string>;

  public constructor(private readonly room: Room) {
    super(room.name);
    this.remoteQueueStore = new Queue<string>(
      `${this.name}_remoteQueue`,
      this.initRemoteQueue,
      this.validateRemoteQueue
    );
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
      MemoryUtils.setCache(`${this.room.name}_dismantleQueue`, [], SockPuppetConstants.PLANNING_INTERVAL);
      return [];
    }
    queue = queue.filter(structure => !!Game.getObjectById(structure.id));
    MemoryUtils.setCache(`${this.room.name}_dismantleQueue`, queue, SockPuppetConstants.PLANNING_INTERVAL);
    return queue;
  }

  /** add remote harvest room names to queue once for each importer */
  private initRemoteQueue = () => {
    const queue: string[] = Array<string>(
      TargetConfig.REMOTE_HARVEST[Game.shard.name].length * TargetConfig.IMPORTERS_PER_REMOTE_ROOM
    );
    let index = 0;
    TargetConfig.REMOTE_HARVEST[Game.shard.name].forEach(name => {
      queue.fill(name, index, TargetConfig.IMPORTERS_PER_REMOTE_ROOM);
      index += TargetConfig.IMPORTERS_PER_REMOTE_ROOM;
    });
    return queue;
  };

  /** check remote harvest room names against config, and drop owned rooms */
  private validateRemoteQueue = (roomName: string) => {
    return (
      TargetConfig.REMOTE_HARVEST[Game.shard.name].some(name => name === roomName) &&
      !Game.rooms[roomName]?.controller?.my
    );
  };

  /**
   * Room remote harvest queue.
   */
  public get remoteQueue(): Queue<string> {
    return this.remoteQueueStore;
  }

  /**
   * Room claim/reserve queue.
   */
  public get claimQueue(): RoomClaim[] {
    CreepUtils.consoleLogIfWatched(this, `getting claim queue`);
    let queue = MemoryUtils.getCache<RoomClaim[]>(`${this.room.name}_claimQueue`);
    if (!queue) {
      CreepUtils.consoleLogIfWatched(this, `load claim queue from config`);
      const claimTargets = TargetConfig.TARGETS[Game.shard.name];
      const remoteHarvestTargets = TargetConfig.REMOTE_HARVEST[Game.shard.name];
      queue = claimTargets
        .concat(remoteHarvestTargets)
        .filter(name => !Game.rooms[name]?.controller?.my)
        .map(name => {
          return new RoomClaim(name);
        });
    }
    // filter out claimed rooms, and remote claims by dead creeps
    queue = queue.filter(claim => !Game.rooms[claim.name]?.controller?.my).map(claim => claim.purgeDeadCreeps());
    const queueString = queue.join();
    CreepUtils.consoleLogIfWatched(this, `claim queue: ${queueString}`);
    MemoryUtils.setCache(`${this.room.name}_claimQueue`, queue, 1000);
    return queue;
  }

  /** get target room from queue */
  public getRoomClaim(creep: Creep): string | undefined {
    CreepUtils.consoleLogIfWatched(this, `getting claim target from queue`);
    const queue = this.claimQueue;
    const queueString = queue.join();
    CreepUtils.consoleLogIfWatched(this, `claim queue: ${queueString}`);
    const MAX_CLAIMERS_PER_ROOM = 1;
    const roomClaim = queue.find(claim => claim.count < MAX_CLAIMERS_PER_ROOM);
    if (roomClaim) {
      roomClaim.get(creep.id);
      console.log(`get claim: ${roomClaim.name}, ${roomClaim.count} claims now`);
      CreepUtils.consoleLogIfWatched(this, `found ${roomClaim.name}, ${roomClaim.count} claims`);
      MemoryUtils.setCache(`${this.room.name}_claimQueue`, queue, 1000);
      return roomClaim.name;
    }
    CreepUtils.consoleLogIfWatched(this, `no unclaimed target rooms found`);
    return undefined;
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
    MemoryUtils.setCache(`${this.room.name}_planVisual`, visual, SockPuppetConstants.PLANNING_INTERVAL);
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
    MemoryUtils.setCache(`${this.room.name}_dismantleVisual`, visual, SockPuppetConstants.PLANNING_INTERVAL);
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
    const positionsAroundSources = this.sources.reduce<RoomPosition[]>((positions: RoomPosition[], source) => {
      const surroundingPositions = PlannerUtils.getPositionSpiral(source.pos, 1);
      CreepUtils.consoleLogIfWatched(this, `positions around ${String(source)}: ${surroundingPositions.length}`);
      return positions.concat(surroundingPositions);
    }, []);
    CreepUtils.consoleLogIfWatched(this, `positions around sources: ${positionsAroundSources.length}`);

    const harvestPositions = positionsAroundSources.filter(pos => PlannerUtils.isEnterable(pos));
    CreepUtils.consoleLogIfWatched(this, `harvest positions: ${harvestPositions.length}`);
    return harvestPositions;
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
        structure.hits < SockPuppetConstants.MAX_HITS_WALL &&
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
