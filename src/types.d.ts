// example declaration file - remove these and add your own custom typings

// memory extension samples
interface CreepMemory {
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
  roadUseLog: { [pos: string]: number };
  sourceInfo: { [id: string]: SourceInfo };
  controllerInfo: ControllerInfo;
  log: string[];
  construction: { [id: string]: ConstructionLog };
  extensionCount: number;
  watched?: boolean;
}

interface SourceInfo {
  sourceId: string;
  containerId?: string;
  minderId?: string;
}

interface ControllerInfo {
  containerId?: string;
  minderId?: string;
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

interface StructureWithStorage {
  store: Store<RESOURCE_ENERGY, false>;
}

interface CreepBodyProfile {
  profile: BodyPartConstant[];
  seed: BodyPartConstant[];
  maxBodyParts: number;
}

interface Memory {
  version?: string;
}

// `global` extension samples
declare namespace NodeJS {
  interface Global {
    log: any;
  }
}
