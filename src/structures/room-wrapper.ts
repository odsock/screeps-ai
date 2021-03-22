import { SpawnWrapper } from "./spawn-wrapper";

// TODO: figure out how to make a singleton for each room
export class RoomWrapper extends Room {
  public constructor(private readonly room: Room) {
    super(room.name);
  }

  get controller(): StructureController | undefined {
    return this.room.controller;
  }

  get constructionWork(): number {
    return this.find(FIND_MY_CONSTRUCTION_SITES)
      .reduce<number>((work: number, site) => { return work + site.progressTotal - site.progress }, 0);
  };

  get spawns(): SpawnWrapper[] {
    return this.find(FIND_MY_SPAWNS).map((spawn) => new SpawnWrapper(spawn));
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