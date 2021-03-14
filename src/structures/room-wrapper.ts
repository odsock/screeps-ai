import { Spawn } from "./spawn";

export class RoomWrapper extends Room {
  public constructor(roomId: string) {
    super(roomId);
  }

  get spawns(): Spawn[] {
    return this.find(FIND_MY_SPAWNS).map((spawn) => new Spawn(spawn));
  } 

  get constructionSites(): ConstructionSite[] {
    return this.find(FIND_CONSTRUCTION_SITES);
  }

  get towers(): StructureTower[] {
    return this.find(FIND_MY_STRUCTURES, { filter: (structure) => structure.structureType == STRUCTURE_TOWER }) as StructureTower[];
  }

  get repairSites(): AnyStructure[] {
    return this.find(FIND_STRUCTURES, { filter: (structure) => structure.hits < structure.hitsMax });
  }

  public roomMemoryLog(message: string): void {
    if (!this.memory.log) {
      this.memory.log = [];
    }
    this.memory.log.push(`${Game.time}: ${message}`);
  }
}