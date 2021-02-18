// example declaration file - remove these and add your own custom typings

// memory extension samples
interface CreepMemory {
  startTime: number;
  room: string;
  dest: string;
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
