// example declaration file - remove these and add your own custom typings

// memory extension samples
interface CreepMemory {
  containerId?: Id<StructureContainer>;
  retiree?: string;
  retiring?: boolean;
  job?: string;
  role: string;
  room?: string;
  working?: boolean;
}

interface RoomMemory {
  roadUseLog: {[pos: string]: number};
  sourceInfo: {[id: string]: SourceInfo};
  controllerInfo: ControllerInfo;
  log: string[];
  construction: { [id: string]: ConstructionLog };
  extensionRoads: boolean;
  controllerRoads: boolean;
  extensionCount: number;
}

interface SourceInfo {
  containerPos?: RoomPosition;
  linkPos?: RoomPosition;
  controllerRoadComplete: boolean;
  spawnRoadComplete: boolean;
}

interface ControllerInfo {
  containerPos?: RoomPosition;
  linkPos?: RoomPosition;
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
  uuid: number;
  log: any;
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
  name: string
  [key: string]: any
}

interface StructureWithStorage {
  store: Store<RESOURCE_ENERGY, false>;
}

// `global` extension samples
declare namespace NodeJS {
  interface Global {
    log: any;
  }
}
