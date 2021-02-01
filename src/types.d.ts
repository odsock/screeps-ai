// example declaration file - remove these and add your own custom typings

// memory extension samples
interface CreepMemory {
  job?: string;
  role: string;
  room?: string;
  working?: boolean;
}

interface RoomMemory {
  extensionRoads: boolean;
  controllerRoads: boolean;
}

interface Memory {
  uuid: number;
  log: any;
}

interface ConstructionPlanPosition {
  xOffset: number;
  yOffset: number;
  structure: StructureConstant;
}

// `global` extension samples
declare namespace NodeJS {
  interface Global {
    log: any;
  }
}
