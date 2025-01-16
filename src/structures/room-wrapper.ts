import { SockPuppetConstants } from "../config/sockpuppet-constants";
import { MemoryUtils } from "planning/memory-utils";
import { SpawnWrapper } from "./spawn-wrapper";
import { PlannerUtils } from "planning/planner-utils";

import { CreepRole } from "config/creep-types";
import { CreepUtils } from "creep-utils";
import { SpawnUtils } from "control/spawn-utils";
import { RoomType, TargetControl } from "control/target-control";

export class RoomWrapper extends Room {
  private targetControl: TargetControl;

  /**
   * Manages singleton RoomWrappers for all rooms this tick.
   * @param roomArg Name of room, or a Room object
   * @returns Instance of RoomWrapper for the room, from cache if possible.
   */
  public static getInstance(roomArg: string | Room): RoomWrapper {
    const name = roomArg instanceof Room ? roomArg.name : roomArg;
    const instance = MemoryUtils.getCache<RoomWrapper>(`${name}_RoomWrapper`);
    if (instance) {
      return instance;
    } else {
      const room = roomArg instanceof Room ? roomArg : Game.rooms[name];
      if (room) {
        const newInstance = new RoomWrapper(room);
        MemoryUtils.setCache(`${name}_RoomWrapper`, newInstance);
        return newInstance;
      }
      throw new Error(`ERROR: invalid room name ${name}`);
    }
  }

  private constructor(private readonly room: Room) {
    super(room.name);
    this.targetControl = TargetControl.getInstance();
  }

  /** Declare getters for properties that don't seem to get copied in when constructed */

  public get controller(): StructureController | undefined {
    return this.room.controller;
  }

  public getEnergyAvailable(): number {
    return this.room.energyAvailable;
  }

  public getEnergyCapacityAvailable(): number {
    return this.room.energyCapacityAvailable;
  }

  public get mode(): string {
    return this.room.mode;
  }

  public get storage(): StructureStorage | undefined {
    return this.room.storage;
  }

  public get terminal(): StructureTerminal | undefined {
    return this.room.terminal;
  }

  /** Getters for some cached properties */

  public get roomType(): RoomType {
    return this.roomType ?? this.targetControl.getRoomType(this.room.name);
  }

  public get hasHostiles(): boolean {
    return this.hostileCreeps.length > 0 || this.hostileStructures.length > 0;
  }
  public get hostileCreeps(): Creep[] {
    return this.room.find(FIND_HOSTILE_CREEPS);
  }
  public get hasHostileCreeps(): boolean {
    return this.room.find(FIND_HOSTILE_CREEPS).length > 0;
  }

  public hasLinks(): boolean {
    return this.room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_LINK }).length > 0;
  }

  /** get hostile structures other than controller */
  public get hostileStructures(): AnyOwnedStructure[] {
    return this.room.find(FIND_HOSTILE_STRUCTURES, {
      filter: structure => structure.structureType !== STRUCTURE_CONTROLLER
    });
  }
  public get hasHostileStructures(): boolean {
    return this.room.find(FIND_HOSTILE_STRUCTURES).length > 0;
  }

  public get hasArmedTowers(): boolean {
    return (
      this.hostileStructures.filter(s => s.structureType === STRUCTURE_TOWER && s.store.energy >= TOWER_ENERGY_COST)
        .length > 0
    );
  }

  public get creeps(): Creep[] {
    return this.room.find(FIND_MY_CREEPS);
  }

  public getCreepsForRole(role: CreepRole): Creep[] {
    return this.room.find(FIND_MY_CREEPS, { filter: c => c.memory.role === role });
  }

  public getHarvesters(): Creep[] {
    return this.getCreepsForRole(CreepRole.HARVESTER);
  }

  public getUpgraders(): Creep[] {
    return this.getCreepsForRole(CreepRole.UPGRADER);
  }

  public getHaulers(): Creep[] {
    return this.getCreepsForRole(CreepRole.HAULER);
  }

  public getBuilders(): Creep[] {
    return this.getCreepsForRole(CreepRole.BUILDER);
  }

  public getWorkers(): Creep[] {
    return this.getCreepsForRole(CreepRole.WORKER);
  }

  public getFixers(): Creep[] {
    return this.getCreepsForRole(CreepRole.FIXER);
  }

  public getGuards(): Creep[] {
    return this.getCreepsForRole(CreepRole.GUARD);
  }

  public get deposits(): Deposit[] {
    return this.room.find(FIND_DEPOSITS);
  }

  // TODO cache this as IDs and invalidate it on new construction somehow
  public get spawns(): SpawnWrapper[] {
    return this.room.find(FIND_MY_SPAWNS).map(spawn => new SpawnWrapper(spawn));
  }

  // TODO cache this as IDs and invalidate it on new construction somehow
  public get extensions(): StructureExtension[] {
    return this.room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_EXTENSION });
  }

  public get spawnStorage(): (StructureExtension | StructureSpawn)[] {
    return [...this.spawns, ...this.extensions];
  }

  /**
   * Structures marked for demolition.
   */
  public get dismantleQueue(): Structure[] {
    let queue = MemoryUtils.getCache<Structure[]>(`${this.room.name}_dismantleQueue`);
    if (!queue) {
      return [];
    }
    queue = queue.filter(structure => !!Game.getObjectById(structure.id));
    MemoryUtils.setCache(`${this.room.name}_dismantleQueue`, queue, -1);
    return queue;
  }

  public set dismantleQueue(queue: Structure[]) {
    MemoryUtils.setCache(`${this.room.name}_dismantleQueue`, queue, -1);
  }

  /**
   * Cached string export of colony plan visual.
   */
  public get planVisual(): string {
    const visual = MemoryUtils.getCache<string>(`${this.room.name}_planVisual`);
    if (visual) {
      return visual;
    }
    return "";
  }

  /**
   * Sets cached string export of colony plan visual.
   */
  public set planVisual(visual: string) {
    MemoryUtils.setCache(`${this.room.name}_planVisual`, visual, SockPuppetConstants.PLANNING_INTERVAL);
  }

  /**
   * Cached string export of demolition plan visual.
   */
  public get dismantleVisual(): string {
    const visual = MemoryUtils.getCache<string>(`${this.room.name}_dismantleVisual`);
    if (visual) {
      return visual;
    }
    return "";
  }

  /**
   * Sets cached string export of demolition plan visual.
   */
  public set dismantleVisual(visual: string) {
    MemoryUtils.setCache(`${this.room.name}_dismantleVisual`, visual, SockPuppetConstants.PLANNING_INTERVAL);
  }

  /**
   * Gets sources in room by calling find.
   */
  public get sources(): Source[] {
    return this.room.find(FIND_SOURCES);
  }

  /** get harvest positions for source */
  public getHarvestPositions(sourceId: Id<Source>): RoomPosition[] {
    return this.memory.sources[sourceId].harvestPositions.map(pos => MemoryUtils.unpackRoomPosition(pos));
  }

  public get harvestPositionCount(): number {
    let count = 0;
    for (const sourceId in this.memory.sources) {
      count += this.memory.sources[sourceId].harvestPositions.length;
    }
    return count;
  }

  public getUpgradePositions(): RoomPosition[] {
    if (!this.controller) {
      return [];
    }

    const cacheKey = `${this.name}_upgradePositions`;
    const cachedPositions = MemoryUtils.getCache<RoomPosition[]>(cacheKey);
    if (cachedPositions) {
      return cachedPositions;
    }

    // default upgrade center is controller
    let target = this.controller.pos;
    let range = 3;

    // prefer link if one exists
    if (this.memory.controller.link?.id) {
      const link = Game.getObjectById(this.memory.controller.link.id);
      if (link) {
        range = 1;
        target = link.pos;
      }
    } else if (this.memory.controller.container?.id) {
      // prefer container if one exists
      const container = Game.getObjectById(this.memory.controller.container.id);
      if (container) {
        range = 1;
        target = container.pos;
      }
    }

    const top = target.y - range;
    const left = target.x - range;
    const bottom = target.y + range;
    const right = target.x + range;
    const avoidPositions = this.lookForAtArea(LOOK_STRUCTURES, top, left, bottom, right, true)
      .filter(s => s.structure.structureType === STRUCTURE_ROAD)
      .map(s => new RoomPosition(s.x, s.y, this.name));

    const upgradePositions = PlannerUtils.getPositionSpiral(target, range).filter(
      pos => !avoidPositions.find(avoidPos => avoidPos.isEqualTo(pos)) && PlannerUtils.isEnterable(pos)
    );

    MemoryUtils.setCache(cacheKey, upgradePositions, 100);
    return upgradePositions;
  }

  /** Gets total energy available in room when sources full */
  public get sourcesEnergyCapacity(): number {
    return this.sources.reduce<number>((capacity, source) => capacity + source.energyCapacity, 0);
  }

  /** stuff that needs caching code */

  public get constructionWork(): number {
    return this.myConstructionSites.reduce<number>((work: number, site) => {
      return work + site.progressTotal - site.progress;
    }, 0);
  }

  public get myConstructionSites(): ConstructionSite[] {
    return this.room.find(FIND_MY_CONSTRUCTION_SITES);
  }

  public get constructionSites(): ConstructionSite[] {
    return this.room.find(FIND_CONSTRUCTION_SITES);
  }

  public get towers(): StructureTower[] {
    return this.room.find(FIND_MY_STRUCTURES, {
      filter: structure => structure.structureType === STRUCTURE_TOWER
    });
  }

  public get repairSites(): AnyStructure[] {
    return this.room.find(FIND_STRUCTURES, { filter: structure => structure.hits < structure.hitsMax });
  }

  public get sourceContainers(): StructureContainer[] {
    const list: StructureContainer[] = [];
    for (const sourceId in this.room.memory.sources) {
      const sourceInfo = this.room.memory.sources[sourceId];
      if (sourceInfo.container?.id) {
        const container = Game.getObjectById(sourceInfo.container.id);
        if (container) {
          list.push(container);
        }
      }
    }
    return list;
  }

  public get controllerContainers(): StructureContainer[] {
    if (this.memory.controller.container?.id) {
      const container = Game.getObjectById(this.memory.controller.container.id);
      if (container) {
        return [container];
      }
    }
    return [];
  }

  /** writes events to memory */

  public roomMemoryLog(message: string): void {
    if (!this.room.memory.log) {
      this.room.memory.log = [];
    }
    this.room.memory.log.push(`${Game.time}: ${message}`);
  }

  /** various find methods */

  public findClosestDamagedNonRoadNotWall(pos: RoomPosition): AnyStructure | null {
    return pos.findClosestByRange(FIND_STRUCTURES, {
      filter: structure =>
        structure.hits < structure.hitsMax &&
        structure.structureType !== STRUCTURE_ROAD &&
        structure.structureType !== STRUCTURE_WALL &&
        structure.structureType !== STRUCTURE_RAMPART &&
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

  public findWeakestWall(): StructureWall | StructureRampart | undefined {
    const wallsToRepair = this.room.find<StructureWall | StructureRampart>(FIND_STRUCTURES, {
      filter: structure =>
        (structure.structureType === STRUCTURE_WALL && structure.hits < SockPuppetConstants.MAX_HITS_WALL) ||
        (structure.structureType === STRUCTURE_RAMPART &&
          structure.hits < SockPuppetConstants.MAX_HITS_WALL &&
          !this.dismantleQueue.find(dismantle => dismantle.id === structure.id))
    });

    if (wallsToRepair.length > 0) {
      return wallsToRepair.reduce((weakestWall, wall) => {
        return weakestWall.hits < wall.hits ? weakestWall : wall;
      });
    } else {
      return undefined;
    }
  }

  public findWeakestRampart(): StructureRampart | undefined {
    const wallsToRepair = this.room.find<StructureRampart>(FIND_STRUCTURES, {
      filter: structure =>
        structure.structureType === STRUCTURE_RAMPART &&
        structure.hits < SockPuppetConstants.MAX_HITS_WALL &&
        !this.dismantleQueue.find(dismantle => dismantle.id === structure.id)
    });

    if (wallsToRepair.length > 0) {
      return wallsToRepair.reduce((weakestWall, wall) => {
        return weakestWall.hits < wall.hits ? weakestWall : wall;
      });
    } else {
      return undefined;
    }
  }

  /** counts parts including spawning creeps */
  public getActiveParts(type: CreepRole, part: BodyPartConstant): number {
    const creeps = this.find(FIND_MY_CREEPS, { filter: c => c.memory.role === type });
    const spawningCount = SpawnUtils.getSpawningPartsForType(this, type, part);
    return CreepUtils.countParts(part, ...creeps) + spawningCount;
  }

  public getInactiveStructures(): Structure[] {
    return this.find(FIND_MY_STRUCTURES, { filter: s => !s.isActive() });
  }
}
