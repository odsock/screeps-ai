/* eslint-disable @typescript-eslint/no-namespace */
import { PlannerUtils } from "./planner-utils";

declare global {
  interface CreepMemory {
    source?: Id<Source>;
    hauleeName?: string; // creep being hauled
    haulerName?: string; // creep doing the hauling
    haulRequested?: boolean; // true if waiting on hauler, or being hauled
    homeRoom?: string;
    constructionSiteId?: string;
    targetRoom?: string;
    containerId?: Id<StructureContainer>;
    retiree?: string;
    retiring?: boolean;
    job?: string;
    role: string;
    working?: boolean;
    watched?: boolean;
  }

  interface RoomMemory {
    defense?: RoomDefense;
    sources: RoomSources;
    spawns?: Id<StructureSpawn>[];
    log: string[];
    logCounts?: LogCounts;
    construction: { [id: string]: ConstructionLog };
    watched?: boolean;
    controller: ControllerInfo;
    storage?: StorageInfo;
  }

  interface StorageInfo {
    haulerId?: Id<Creep>;
  }

  interface RoomDefense {
    hostiles: Creep[];
  }

  interface LogCounts {
    spawnCount?: number;
    rcl?: number;
    extensionCount?: number;
  }

  interface SourceInfo {
    harvestPositions: string[];
    id: Id<Source>;
    pos: string;
    containerConstructionSiteId?: Id<ConstructionSite>;
    containerPos?: string;
    containerId?: Id<StructureContainer>;
    minderId?: Id<Creep>;
    haulerId?: Id<Creep>;
    linkId?: Id<StructureLink>;
  }

  interface RoomSources {
    [id: string]: SourceInfo;
  }

  interface ControllerInfo {
    containerConstructionSiteId?: Id<ConstructionSite>;
    containerPos?: string;
    containerId?: Id<StructureContainer>;
    haulerId?: Id<Creep>;
    linkId?: Id<StructureLink>;
  }

  interface ConstructionLog {
    id: Id<ConstructionSite<BuildableStructureConstant>>;
    startTime: number;
    endTime?: number;
    progress?: number;
    type: BuildableStructureConstant;
    pos: RoomPosition;
  }

  interface Memory {
    cache?: string;
    version?: string;
  }

  namespace NodeJS {
    interface Global {
      log: any;
      cache: Map<string, CacheValue>;
      watch: (key: Id<any>) => void;
      unwatch: (key: Id<any>) => void;
      placeExt: (pos: RoomPosition, structure: StructureConstant) => void;
      getPositionSpiral: (centerPos: RoomPosition, maxRange: number) => void;
      Profiler: Profiler;
    }
  }
}

interface CacheValue {
  item: any;
  expires: number;
}

export class MemoryUtils {
  public static unpackRoomPosition(positionString: string): RoomPosition {
    if (!positionString) throw new Error("Position string is empty or undefined");
    const positionArray: string[] = positionString.split(":");
    return new RoomPosition(Number(positionArray[0]), Number(positionArray[1]), positionArray[2]);
  }

  public static packRoomPosition(pos: RoomPosition): string {
    return `${pos.x}:${pos.y}:${pos.roomName}`;
  }

  public static refreshRoomMemory(room: Room): void {
    this.refreshSourceMemory(room);
    this.refreshControllerMemory(room);
  }

  public static writeCacheToMemory(): void {
    // init cache if not yet set
    if (!global.cache) {
      MemoryUtils.initCache();
    }
    // don't keep items that will be expired next tick
    global.cache.forEach((value, key) => {
      if (value.expires <= Game.time + 1) {
        global.cache.delete(key);
      }
    });
    // stringify cache to memory
    Memory.cache = JSON.stringify(Array.from(global.cache.entries()));
  }

  private static initCache() {
    if (!global.cache && Memory.cache) {
      console.log(`deserializing cache from memory`);
      global.cache = new Map(JSON.parse(Memory.cache));
    } else {
      global.cache = new Map<string, CacheValue>();
    }
  }

  public static setCache<T>(key: string, item: T, ttl = 1): void {
    if (!global.cache) {
      MemoryUtils.initCache();
    }
    global.cache.set(key, { item, expires: Game.time + ttl } as CacheValue);
  }

  public static getCache<T>(key: string): T | undefined {
    if (!global.cache) {
      MemoryUtils.initCache();
    }

    const value = global.cache.get(key);
    if (value && value.expires > Game.time) {
      return value.item as T;
    }
    global.cache.delete(key);
    return undefined;
  }

  public static refreshControllerMemory(room: Room): void {
    // initialize controller memory
    const controllerMemory = room.memory.controller;
    if (!controllerMemory) {
      room.memory.controller = {};
    }

    // validate id's
    const controllerInfo = room.memory.controller;
    if (controllerInfo.containerId && !Game.getObjectById(controllerInfo.containerId)) {
      controllerInfo.containerId = undefined;
    }
    if (controllerInfo.linkId && !Game.getObjectById(controllerInfo.linkId)) {
      controllerInfo.linkId = undefined;
    }
    if (controllerInfo.haulerId && !Game.getObjectById(controllerInfo.haulerId)) {
      controllerInfo.haulerId = undefined;
    }
  }

  public static refreshSourceMemory(room: Room): void {
    // initialize source memory
    const sourceMemory = room.memory.sources;
    if (!sourceMemory) {
      const roomSources: RoomSources = MemoryUtils.getRoomSources(room);
      room.memory.sources = roomSources;
    }

    // validate id's
    for (const sourceId in room.memory.sources) {
      const sourceInfo = room.memory.sources[sourceId];
      if (sourceInfo.containerId && !Game.getObjectById(sourceInfo.containerId)) {
        sourceInfo.containerId = undefined;
      }
      if (sourceInfo.linkId && !Game.getObjectById(sourceInfo.linkId)) {
        sourceInfo.linkId = undefined;
      }
      if (sourceInfo.minderId && !Game.getObjectById(sourceInfo.minderId)) {
        sourceInfo.minderId = undefined;
      }
      if (sourceInfo.haulerId && !Game.getObjectById(sourceInfo.haulerId)) {
        sourceInfo.haulerId = undefined;
      }
    }
  }

  // not sure this should be here, but it's static info about a room so only done once
  private static getRoomSources(room: Room): RoomSources {
    const roomSources: RoomSources = {};
    room.find(FIND_SOURCES).forEach(source => {
      const harvestPositions = PlannerUtils.getPositionSpiral(source.pos, 1)
        .filter(pos => PlannerUtils.isEnterable(pos))
        .map(pos => this.packRoomPosition(pos));
      roomSources[source.id] = {
        id: source.id,
        pos: this.packRoomPosition(source.pos),
        harvestPositions
      };
    });
    return roomSources;
  }
}
