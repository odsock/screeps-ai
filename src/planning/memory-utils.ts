/* eslint-disable @typescript-eslint/no-namespace */

import { Sockpuppet } from "sockpuppet";

declare global {
  interface CreepMemory {
    source?: Id<Source>;
    hauleeName?: string; // creep being hauled
    haulerName?: string; // creep doing the hauling
    haulRequested?: boolean; // true if waiting on hauler, or being hauled
    homeRoom: string;
    constructionSiteId?: string;
    targetRoom: string;
    containerId?: Id<StructureContainer>;
    retiree?: string;
    retiring?: boolean;
    job?: string;
    role: string;
    working?: boolean;
    watched?: boolean;
    path?: string;
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
    reconTick: number;
    centerPoint?: string;
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
    structure: StructureController;
    pos: string;
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
      log: any;
      cache: Map<string, CacheValue>;
      watch: (key: Id<any>) => void;
      unwatch: (key: Id<any>) => void;
      profile: (key: Id<any>) => void;
      unprofile: (key: Id<any>) => void;
      placeExt: (pos: RoomPosition, structure: StructureConstant) => void;
      printCpuUsage: () => void;
      clearCpuUsage: () => void;
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
}
