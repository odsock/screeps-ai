// example declaration file - remove these and add your own custom typings

// memory extension samples
interface CreepMemory {
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
  spawns?: Id<StructureSpawn>[];
  harvestPositions: string[];
  costMatrix?: { [name: string]: number[] };
  roadUseLog: { [pos: string]: number };
  log: string[];
  construction: { [id: string]: ConstructionLog };
  extensionCount: number;
  watched?: boolean;
  containers: ContainerInfo[];
  sources?: Id<Source>[];
}

interface ContainerInfo {
  containerId: string;
  minderId?: string;
  nearSource: boolean;
  nearController: boolean;
  haulers: string[];
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
  }
}
