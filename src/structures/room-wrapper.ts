import { PlannerUtils } from "planning/planner-utils";

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

  public get sourceContainers(): StructureContainer[] {
    return this.room.memory.containers.reduce<StructureContainer[]>((list: StructureContainer[], containerInfo) => {
      if (containerInfo.nearSource) {
        const container = Game.getObjectById(containerInfo.containerId as Id<StructureContainer>);
        if (container !== null) {
          list.push(container);
        }
      }
      return list;
    }, []);
  }

  private harvestPositionsCache: RoomPosition[] | undefined;

  public get harvestPositions(): RoomPosition[] {
    if (this.harvestPositionsCache) {
      return this.harvestPositionsCache;
    } else if (this.memory.harvestPositions) {
      this.harvestPositionsCache = this.memory.harvestPositions.map(pos => PlannerUtils.unpackRoomPosition(pos));
    } else {
      this.harvestPositionsCache = this.findHarvestPositions();
      this.memory.harvestPositions = this.harvestPositionsCache.map(pos => PlannerUtils.packRoomPosition(pos));
    }
    return this.harvestPositionsCache;
  }

  private findHarvestPositions(): RoomPosition[] {
    return this.room
      .find(FIND_SOURCES)
      .reduce<RoomPosition[]>((positions: RoomPosition[], source) => {
        return positions.concat(PlannerUtils.getPositionSpiral(source.pos, 1));
      }, [])
      .filter(pos => PlannerUtils.isEnterable(pos));
  }

  private costMatrixCache: { [name: string]: CostMatrix } = {};

  public getCostMatrix(name: string, costMatrix: CostMatrix): CostMatrix {
    if (!this.memory.costMatrix) {
      this.memory.costMatrix = {};
    }

    if (this.costMatrixCache[name]) {
      return this.costMatrixCache[name];
    } else if (this.memory.costMatrix[name]) {
      this.costMatrixCache[name] = costMatrix.deserialize(this.memory.costMatrix[name]);
    } else {
      switch (name) {
        case "avoidHarvestPositions":
          this.harvestPositions.forEach(pos => costMatrix.set(pos.x, pos.y, 0xff));
          break;

        default:
          throw new Error(`Unknown cost matrix ${name}`);
      }
      this.costMatrixCache[name] = costMatrix;
      this.memory.costMatrix[name] = costMatrix.serialize();
    }
    return costMatrix;
  }

  public get controllerContainers(): StructureContainer[] {
    return this.room.memory.containers.reduce<StructureContainer[]>((list: StructureContainer[], containerInfo) => {
      if (containerInfo.nearController) {
        const container = Game.getObjectById(containerInfo.containerId as Id<StructureContainer>);
        if (container !== null) {
          list.push(container);
        }
      }
      return list;
    }, []);
  }

  public roomMemoryLog(message: string): void {
    if (!this.memory.log) {
      this.memory.log = [];
    }
    this.memory.log.push(`${Game.time}: ${message}`);
  }
}
