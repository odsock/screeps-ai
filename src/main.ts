/* eslint-disable @typescript-eslint/no-namespace */
import { Sockpuppet } from "sockpuppet";
import { ErrorMapper } from "utils/ErrorMapper";
import { Logger } from "./logger";
import { SockPuppetConstants } from "./config/sockpuppet-constants";
import "./utils/console-scripts.js";
import { MemoryUtils } from "planning/memory-utils";

declare global {
  /*
    Types added in this `global` block are in an ambient, global context. This is needed because `main.ts` is a module file (uses import or export).
    Interfaces matching on name from @types/screeps will be merged. This is how you can extend the 'built-in' interfaces from @types/screeps.
  */
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
    room?: string;
    working?: boolean;
    watched?: boolean;
  }

  interface RoomMemory {
    defense?: RoomDefense;
    sources: RoomSources;
    spawns?: Id<StructureSpawn>[];
    costMatrix?: { [name: string]: number[] };
    log: string[];
    logCounts?: LogCounts;
    construction: { [id: string]: ConstructionLog };
    watched?: boolean;
    controller: ControllerInfo;
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

  interface StructurePatternPosition {
    xOffset: number;
    yOffset: number;
    structure: StructureConstant;
  }
  interface StructurePlanPosition {
    pos: RoomPosition;
    structure: StructureConstant;
  }

  interface Watchable {
    name: string;
    [key: string]: any;
    memory: { watched?: boolean };
  }

  interface StructureWithStorage extends Structure {
    store: StoreDefinition;
  }

  interface Memory {
    cache?: string;
    version?: string;
  }

  interface CacheValue {
    item: any;
    expires: number;
  }

  namespace NodeJS {
    interface Global {
      log: any;
      cache: Map<string, CacheValue>;
      watch: (key: Id<any>) => void;
      unwatch: (key: Id<any>) => void;
      placeExt: (pos: RoomPosition, structure: StructureConstant) => void;
      getPositionSpiral: (centerPos: RoomPosition, maxRange: number) => void;
    }
  }
}

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = ErrorMapper.wrapLoop(() => {
  // check version
  try {
    const version = process.env.npm_package_version;
    if (!Memory.version || Memory.version !== version) {
      Memory.version = version;
      console.log(SockPuppetConstants.BANNER_HEADER);
      console.log(SockPuppetConstants.BANNER_BODY);
      console.log(`Version: ${String(version)}`);
      console.log(SockPuppetConstants.BANNER_FOOTER);
    }
  } catch (error) {
    console.log(error);
  }

  console.log(`Current game tick is ${Game.time}`);
  cleanupDeadCreepMemory();

  MemoryUtils.writeCacheToMemory();

  const sockpuppet = new Sockpuppet();
  sockpuppet.run();

  const logger = new Logger();
  logger.run();
});

// Automatically delete memory of missing creeps
function cleanupDeadCreepMemory() {
  for (const name in Memory.creeps) {
    if (!(name in Game.creeps)) {
      delete Memory.creeps[name];
    }
  }
}
