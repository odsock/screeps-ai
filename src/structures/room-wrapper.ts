import { Constants } from "../constants";
import { MemoryUtils } from "planning/memory-utils";
import { PlannerUtils } from "planning/planner-utils";

// TODO: figure out how to make a singleton for each room
export class RoomWrapper extends Room {
  public constructor(private readonly room: Room) {
    super(room.name);

    // console.log(`controller ${String(this.controller)}`);
    // console.log(`energyAvailable ${String(this.energyAvailable)}`);
    // console.log(`energyCapacityAvailable ${String(this.energyCapacityAvailable)}`);
    // console.log(`memory ${String(this.memory)}`);
    // console.log(`mode ${String(this.mode)}`);
    // console.log(`name ${String(this.name)}`);
    // console.log(`storage ${String(this.storage)}`);
    // console.log(`terminal ${String(this.terminal)}`);
    // console.log(`visual ${String(this.visual)}`);
    // console.log(`getEventLog ${String(this.getEventLog())}`);

    // [3:18:12 PM][shard3]controller [structure (controller) #5bbcade89099fc012e6381d9]
    // [3:18:12 PM][shard3]energyAvailable 0
    // [3:18:12 PM][shard3]energyCapacityAvailable 0
    // [3:18:12 PM][shard3]mode undefined
    // [3:18:12 PM][shard3]name E17N55
    // [3:18:12 PM][shard3]storage undefined
    // [3:18:12 PM][shard3]terminal undefined
    // [3:18:12 PM][shard3]visual [object Object]
    // [3:18:12 PM][shard3]controller [structure (controller) #5bbcade89099fc012e6381d9]
    // [3:18:12 PM][shard3]energyAvailable 0
    // [3:18:12 PM][shard3]energyCapacityAvailable 0
    // [3:18:12 PM][shard3]mode undefined
    // [3:18:12 PM][shard3]name E17N55
    // [3:18:12 PM][shard3]storage undefined
    // [3:18:12 PM][shard3]terminal undefined
    // [3:18:12 PM][shard3]visual [object Object]
  }

  public get dismantleQueue(): Structure[] {
    let queue = MemoryUtils.getCache<Structure[]>(`${this.room.name}_dismantleQueue`);
    if (!queue) {
      MemoryUtils.setCache(`${this.room.name}_dismantleQueue`, []);
      return [];
    }
    queue = queue.filter(structure => !!Game.getObjectById(structure.id));
    MemoryUtils.setCache(`${this.room.name}_dismantleQueue`, queue);
    return queue;
  }

  public get planVisual(): string {
    return MemoryUtils.getCache<string>(`${this.room.name}_planVisual`);
  }

  public set planVisual(visual: string) {
    MemoryUtils.setCache(`${this.room.name}_planVisual`, visual);
  }

  public get dismantleVisual(): string {
    return MemoryUtils.getCache<string>(`${this.room.name}_dismantleVisual`);
  }

  public set dismantleVisual(visual: string) {
    MemoryUtils.setCache(`${this.room.name}_dismantleVisual`, visual);
  }

  // TODO cache this as well
  public get deposits(): Deposit[] {
    return this.room.find(FIND_DEPOSITS);
  }

  // TODO cache this too
  public get sources(): Source[] {
    return this.room.find(FIND_SOURCES);
  }

  // TODO cache this
  public get spawns(): StructureSpawn[] {
    return this.room.find(FIND_MY_SPAWNS);
  }

  public get controller(): StructureController | undefined {
    return this.room.controller;
  }

  public get constructionWork(): number {
    return this.room.find(FIND_MY_CONSTRUCTION_SITES).reduce<number>((work: number, site) => {
      return work + site.progressTotal - site.progress;
    }, 0);
  }

  public get constructionSites(): ConstructionSite[] {
    return this.room.find(FIND_CONSTRUCTION_SITES);
  }

  public get towers(): StructureTower[] {
    return this.room.find(FIND_MY_STRUCTURES, {
      filter: structure => structure.structureType === STRUCTURE_TOWER
    }) as StructureTower[];
  }

  public get repairSites(): AnyStructure[] {
    return this.room.find(FIND_STRUCTURES, { filter: structure => structure.hits < structure.hitsMax });
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
    } else if (this.room.memory.harvestPositions) {
      this.harvestPositionsCache = this.room.memory.harvestPositions.map(pos => PlannerUtils.unpackRoomPosition(pos));
    } else {
      this.harvestPositionsCache = this.findHarvestPositions();
      this.room.memory.harvestPositions = this.harvestPositionsCache.map(pos => PlannerUtils.packRoomPosition(pos));
    }
    return this.harvestPositionsCache;
  }

  private findHarvestPositions(): RoomPosition[] {
    return this.sources
      .reduce<RoomPosition[]>((positions: RoomPosition[], source) => {
        return positions.concat(PlannerUtils.getPositionSpiral(source.pos, 1));
      }, [])
      .filter(pos => PlannerUtils.isEnterable(pos));
  }

  private costMatrixCache: { [name: string]: CostMatrix } = {};

  public getCostMatrix(name: string, costMatrix: CostMatrix): CostMatrix {
    if (!this.room.memory.costMatrix) {
      this.room.memory.costMatrix = {};
    }

    if (this.costMatrixCache[name]) {
      return this.costMatrixCache[name];
    } else if (this.room.memory.costMatrix[name]) {
      this.costMatrixCache[name] = PathFinder.CostMatrix.deserialize(this.room.memory.costMatrix[name]);
    } else {
      switch (name) {
        case "avoidHarvestPositions":
          this.harvestPositions.forEach(pos => costMatrix.set(pos.x, pos.y, 0xff));
          break;

        default:
          throw new Error(`Unknown cost matrix ${name}`);
      }
      this.costMatrixCache[name] = costMatrix;
      this.room.memory.costMatrix[name] = costMatrix.serialize();
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
    if (!this.room.memory.log) {
      this.room.memory.log = [];
    }
    this.room.memory.log.push(`${Game.time}: ${message}`);
  }

  public findClosestDamagedNonRoad(pos: RoomPosition): AnyStructure | null {
    return pos.findClosestByRange(FIND_STRUCTURES, {
      filter: structure =>
        structure.hits < structure.hitsMax &&
        structure.structureType !== STRUCTURE_ROAD &&
        structure.structureType !== STRUCTURE_WALL &&
        !this.dismantleQueue.find(dismantle => dismantle.id === structure.id)
    });
  }

  public findClosestDamagedRoad(pos: RoomPosition): StructureRoad | null {
    return pos.findClosestByRange<StructureRoad>(FIND_STRUCTURES, {
      filter: structure =>
        structure.hits < structure.hitsMax &&
        structure.structureType === STRUCTURE_ROAD &&
        !this.dismantleQueue.find(dismantle => dismantle.id === structure.id)
    });
  }

  public findWeakestWall(): StructureWall | null {
    const wallsToRepair = this.room.find<StructureWall>(FIND_STRUCTURES, {
      filter: structure =>
        structure.hits < Constants.MAX_HITS_WALL &&
        (structure.structureType === STRUCTURE_WALL || structure.structureType === STRUCTURE_RAMPART) &&
        !this.dismantleQueue.find(dismantle => dismantle.id === structure.id)
    });

    if (wallsToRepair.length > 0) {
      return wallsToRepair.reduce((weakestWall, wall) => {
        return weakestWall.hits < wall.hits ? weakestWall : wall;
      });
    } else {
      return null;
    }
  }
}
