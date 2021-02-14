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
  log: string[];
  construction: { [id: string]: ConstructionLog };
  extensionRoads: boolean;
  controllerRoads: boolean;
  extensionCount?: number;
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

interface StructurePlanPosition {
  xOffset: number;
  yOffset: number;
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
