// example declaration file - remove these and add your own custom typings

// memory extension samples
interface CreepMemory {
  job?: string;
  role: string;
  room?: string;
  working?: boolean;
}

interface RoomMemory {
  controllerRoads: { complete: boolean, paths: { [sourceName: string]: PathFinderPath; } };
}

interface Memory {
  uuid: number;
  log: any;
}

// `global` extension samples
declare namespace NodeJS {
  interface Global {
    log: any;
  }
}
