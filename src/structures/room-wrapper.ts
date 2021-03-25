// TODO: figure out how to make a singleton for each room
export class RoomWrapper extends Room {
  public constructor(private readonly room: Room) {
    super(room.name);
    // does this work?
    // Object.create(RoomPosition.prototype, Object.getOwnPropertyDescriptors(pos));
  }

  public get controller(): StructureController | undefined {
    return this.room.controller;
  }

  public get constructionWork(): number {
    return this.find(FIND_MY_CONSTRUCTION_SITES).reduce<number>((work: number, site) => {
      return work + site.progressTotal - site.progress;
    }, 0);
  }

  public get constructionSites(): ConstructionSite[] {
    return this.find(FIND_CONSTRUCTION_SITES);
  }

  public get towers(): StructureTower[] {
    return this.find(FIND_MY_STRUCTURES, {
      filter: structure => structure.structureType === STRUCTURE_TOWER
    }) as StructureTower[];
  }

  public get repairSites(): AnyStructure[] {
    return this.find(FIND_STRUCTURES, { filter: structure => structure.hits < structure.hitsMax });
  }

  public roomMemoryLog(message: string): void {
    if (!this.memory.log) {
      this.memory.log = [];
    }
    this.memory.log.push(`${Game.time}: ${message}`);
  }
}
