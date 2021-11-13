/* eslint-disable @typescript-eslint/no-namespace */

import { Sockpuppet } from "sockpuppet";

declare global {
  interface RoomMemory {
    defense?: RoomDefense;
    sources: RoomSources;
    spawns?: Id<StructureSpawn>[];
    extensions?: Id<StructureExtension>[];
    log: string[];
    logCounts?: LogCounts;
    construction: { [id: string]: ConstructionLog };
    watched?: boolean;
    controller: ControllerInfo;
    storage?: StorageInfo;
    reconTick: number;
    centerPoint?: string;
    remoteHarvest?: { [roomName: string]: RemoteHarvest };
    owner?: string;
  }

  interface RemoteHarvest {
    importersNeeded: number;
    spawnCapacity: number;
  }
  interface StorageInfo {
    haulerId?: Id<Creep>;
  }

  interface RoomDefense {
    structures: AnyOwnedStructure[];
    creeps: Creep[];
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
    pos: string;
    owner?: Owner;
    reservation?: ReservationDefinition;
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

  interface SpawnMemory {
    watched?: boolean;
    spawning?: SpawningInfo;
  }

  interface SpawningInfo {
    name: string;
    body: BodyPartConstant[];
    memory: CreepMemory;
  }

  interface Memory {
    cache?: string;
    version?: string;
    cpu: CpuTracking;
  }

  interface CpuTracking {
    tickTotal: number[];
    allCreeps: number[];
    creepsByRole: {
      [role: string]: number[];
    };
  }

  namespace NodeJS {
    interface Global {
      sockpuppet: Sockpuppet;
      cache: Map<string, CacheValue>;
      watch: (key: string) => void;
      unwatch: (key: string) => void;
      placeExt: (pos: RoomPosition, structure: StructureConstant) => void;
      printCpuUsage: () => void;
      clearCpuUsage: () => void;
      testGetRoomWrapper: (roomArg: string | Room) => void;
      drawCostMatrix: (roomName: string) => void;
      drawRoadPlan: (origin: RoomPosition, goal: RoomPosition, range: number) => void;
      Profiler: Profiler;
    }
  }
}

interface CacheValue {
  item: unknown;
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

  // TODO memory caching is flawed due to shallow serialization, and restoring objects that have no methods
  private static writeCacheToMemory(): void {
    // init cache if not yet set
    if (!global.cache) {
      MemoryUtils.initCache();
    }
    // don't keep items that are expired
    global.cache.forEach((value, key) => {
      if (this.isExpired(value.expires)) {
        global.cache.delete(key);
      }
    });
    // stringify cache to memory
    Memory.cache = JSON.stringify(Array.from(global.cache.entries()));
  }

  private static readCacheFromMemory(): void {
    if (Memory.cache) {
      console.log(`deserializing cache from memory`);
      global.cache = new Map(JSON.parse(Memory.cache));
    }
  }

  private static initCache() {
    global.cache = new Map<string, CacheValue>();
  }

  public static setCache<T>(key: string, item: T, ttl = 1): void {
    if (!global.cache) {
      MemoryUtils.initCache();
    }
    const expires = ttl === -1 ? ttl : Game.time + ttl;
    global.cache.set(key, { item, expires } as CacheValue);
  }

  public static getCache<T>(key: string): T | undefined {
    if (!global.cache) {
      MemoryUtils.initCache();
    }

    const value = global.cache.get(key);
    if (!value || this.isExpired(value.expires)) {
      global.cache.delete(key);
      return undefined;
    }
    return value.item as T;
  }

  public static hasCache(key: string): boolean {
    return global.cache.has(key);
  }

  public static deleteCache(key: string): boolean {
    return global.cache.delete(key);
  }

  /** check if expiration has passed, using -1 to mean no expiration */
  private static isExpired(expires: number): boolean {
    return expires === -1 ? false : expires <= Game.time;
  }
}
