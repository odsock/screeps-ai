interface CreepMemory {
  destinationType?: string; // type of destination (container, source, controller, etc)
  destination?: string; // position to be hauled to if requested
  source?: string;
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
  sources: RoomSources;
  spawns?: Id<StructureSpawn>[];
  costMatrix?: { [name: string]: number[] };
  roadUseLog: { [pos: string]: number };
  log: string[];
  construction: { [id: string]: ConstructionLog };
  extensionCount: number;
  watched?: boolean;
  controller: ControllerInfo;
}

interface SourceInfo {
  harvestPositions: string[];
  id: Id<Source>;
  pos: string;
  containerId?: Id<StructureContainer>;
  minderId?: Id<Creep>;
  haulerId?: Id<Creep>;
  linkId?: Id<StructureLink>;
}

interface RoomSources {
  [id: string]: SourceInfo;
}

interface ControllerInfo {
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

interface CreepBodyProfile {
  profile: BodyPartConstant[];
  seed: BodyPartConstant[];
  maxBodyParts: number;
  maxWorkParts?: number;
}

interface Memory {
  cache?: string;
  version?: string;
}

interface CacheValue {
  item: any;
  expires: number;
}

// `global` extension samples
declare namespace NodeJS {
  interface Global {
    log: any;
    cache: Map<string, CacheValue>;
    watch: (key: Id<any>) => void;
    unwatch: (key: Id<any>) => void;
    placeExt: (pos: RoomPosition, structure: StructureConstant) => void;
    getPositionSpiral: (centerPos: RoomPosition, maxRange: number) => void;
  }
}
