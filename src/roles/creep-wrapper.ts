import { CreepRole } from "config/creep-types";
import { Task } from "control/task-management";
import { CreepUtils } from "creep-utils";
import { MemoryUtils } from "planning/memory-utils";
import { RoomWrapper } from "structures/room-wrapper";
import { CostMatrixUtils } from "utils/cost-matrix-utils";
import { profile } from "../../screeps-typescript-profiler";

declare global {
  interface CreepMemory {
    source?: Id<Source>;
    hauleeName?: string; // creep being hauled
    haulerName?: string; // creep doing the hauling
    haulRequested?: boolean; // true if waiting on hauler, or being hauled
    homeRoom: string;
    constructionSiteId?: string;
    targetRoom: string;
    containerId?: Id<StructureContainer>;
    replacing?: string;
    retiring?: boolean;
    job?: string;
    role: CreepRole;
    working?: boolean;
    watched?: boolean;
    path?: string;
    pathRoom?: string; // name of room path is valid for
    idleZone?: Id<Source | StructureStorage | StructureSpawn>; // id of source, storage, or spawn where hauler is idling
    task?: Task;
    lastPos?: string;
    stuckCount?: number;
    moved?: boolean;
    draw?: boolean;
    lastTargetId?: Id<Structure>;
  }
}

export interface CreepBodyProfile {
  profile: BodyPartConstant[];
  seed: BodyPartConstant[];
  maxBodyParts: number;
  maxWorkParts?: number;
}

export interface CreepWrapperProfile {
  ROLE: CreepRole;
  BODY_PROFILE: CreepBodyProfile;
}

@profile
export abstract class CreepWrapper extends Creep {
  private pickingUp = false;
  private withdrawing = false;
  private pickingUpAmount = 0;

  public constructor(private readonly creep: Creep) {
    super(creep.id);
  }

  public abstract run(): void;

  public get roomw(): RoomWrapper {
    return RoomWrapper.getInstance(this.room.name);
  }

  public moveToW(target: RoomObject | RoomPosition, moveOpts?: MoveToOpts): ScreepsReturnCode {
    const stuckFlag = this.clearPathIfStuck();
    const visualizePathStyle: PolyStyle = { stroke: "#00FF00" };
    if (stuckFlag) {
      CreepUtils.consoleLogIfWatched(this, `Stuck. Pathing around creeps.`);
      visualizePathStyle.stroke = "#FF0000";
      visualizePathStyle.opacity = 0.8;
    }
    moveOpts = {
      plainCost: 2,
      swampCost: 10,
      reusePath: 10,
      visualizePathStyle,
      costCallback: CostMatrixUtils.creepMovementCostCallback,
      ...moveOpts
    };
    return this.moveTo(target, moveOpts);
  }

  public moveW(direction: DirectionConstant): ScreepsReturnCode {
    // check if stuck, even though we don't handle it with directional moves
    this.isStuck();
    return this.move(direction);
  }

  protected clearPathIfStuck(): boolean {
    if (this.isStuck()) {
      CreepUtils.consoleLogIfWatched(this, `stuck, clearing path`);
      delete this.memory.path;
      delete this.memory.lastPos;
      delete this.memory.stuckCount;
      return true;
    }
    return false;
  }

  protected isStuck(): boolean {
    if (this.memory.lastPos) {
      const lastPos = MemoryUtils.unpackRoomPosition(this.memory.lastPos);
      if (this.pos.isEqualTo(lastPos)) {
        this.memory.stuckCount = (this.memory.stuckCount ?? 0) + 1;
        this.room.visual.circle(this.pos.x, this.pos.y, { fill: "#000000" });
      } else {
        this.memory.stuckCount = 0;
      }
      CreepUtils.consoleLogIfWatched(this, `stuck count: ${String(this.memory.stuckCount)}`);
    }
    this.memory.lastPos = MemoryUtils.packRoomPosition(this.pos);
    return (this.memory.stuckCount ?? 0) > 2;
  }

  protected updateJob(job: string): void {
    if (this.memory.job !== job) {
      this.memory.working = false;
      // not idle if switching job
      this.memory.idleZone = undefined;
      this.memory.job = job;
      this.say(job);
    }
  }

  protected stopWorkingIfEmpty(resourceType: ResourceConstant = RESOURCE_ENERGY): void {
    if (this.memory.working && this.store.getUsedCapacity(resourceType) === 0) {
      CreepUtils.consoleLogIfWatched(this, "stop working, empty");
      if (this.memory.working) {
        this.memory.working = false;
        this.say("⚡");
      }
    }
  }

  protected startWorkingIfEmpty(resourceType: ResourceConstant = RESOURCE_ENERGY): void {
    if (!this.memory.working && this.store.getUsedCapacity(resourceType) === 0) {
      CreepUtils.consoleLogIfWatched(this, "start working, empty");
      if (!this.memory.working) {
        this.memory.working = true;
        this.say("🚧");
      }
    }
  }

  protected startWorkingIfNotEmpty(resourceType: ResourceConstant = RESOURCE_ENERGY): void {
    if (!this.memory.working && this.store.getUsedCapacity(resourceType) > 0) {
      CreepUtils.consoleLogIfWatched(this, "start working, have energy");
      if (!this.memory.working) {
        this.memory.working = true;
        this.say("🚧");
      }
    }
  }

  protected startWorkingIfFull(resourceType: ResourceConstant = RESOURCE_ENERGY): void {
    if (!this.memory.working && this.store.getFreeCapacity(resourceType) === 0) {
      CreepUtils.consoleLogIfWatched(this, "start working, full");
      if (!this.memory.working) {
        this.memory.working = true;
        this.say("🚧");
      }
    }
  }

  protected stopWorkingIfFull(): void {
    if (this.memory.working && this.store.getFreeCapacity() === 0) {
      CreepUtils.consoleLogIfWatched(this, "stop working, full");
      if (this.memory.working) {
        this.memory.working = false;
        this.say("🚚");
      }
    }
  }

  protected startWorkingInRange(
    jobsite: RoomPosition,
    range = 3,
    resourceType: ResourceConstant = RESOURCE_ENERGY
  ): void {
    if (this.store.getUsedCapacity(resourceType) !== 0 && this.pos.inRangeTo(jobsite, range)) {
      CreepUtils.consoleLogIfWatched(this, `in range: starting work`);
      if (!this.memory.working) {
        this.memory.working = true;
        this.say("🛠️");
      }
    }
  }

  protected findClosestTombstoneWithEnergy(): Tombstone | null {
    return this.pos.findClosestByPath(FIND_TOMBSTONES, { filter: t => t.store.getUsedCapacity(RESOURCE_ENERGY) > 0 });
  }

  /** find closest container with at least a minimum amount of energy */
  protected findClosestContainerWithEnergy(min = 0): StructureContainer | null {
    const container = this.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_CONTAINER && s.store.getUsedCapacity() > 0 && s.store.energy > min
    });
    return container as StructureContainer;
  }

  protected findClosestSourceContainer(): StructureContainer | null {
    const sources = this.room.find(FIND_SOURCES);
    const containers: StructureContainer[] = [];
    if (sources.length > 0) {
      for (const source of sources) {
        const container = source.pos.findInRange(FIND_STRUCTURES, 1, {
          filter: s => s.structureType === STRUCTURE_CONTAINER
        });
        if (container.length > 0) {
          containers.push(container[0] as StructureContainer);
        }
      }
    }
    return this.pos.findClosestByPath(containers);
  }

  protected findClosestSourceContainerNotEmpty(): StructureContainer | null {
    const sources = this.room.find(FIND_SOURCES);
    const containers: StructureContainer[] = [];
    if (sources.length > 0) {
      for (const source of sources) {
        const container = source.pos.findInRange(FIND_STRUCTURES, 1, {
          filter: s => s.structureType === STRUCTURE_CONTAINER && s.store.getUsedCapacity() > 0
        });
        if (container.length > 0) {
          containers.push(container[0] as StructureContainer);
        }
      }
    }
    return this.pos.findClosestByPath(containers);
  }

  protected findClosestRuinsWithEnergy(): Ruin | null {
    return this.pos.findClosestByPath(FIND_RUINS, { filter: r => r.store.getUsedCapacity(RESOURCE_ENERGY) > 0 });
  }

  protected findClosestEnergyDrop(): Resource<RESOURCE_ENERGY> | null {
    return this.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
      filter: r => r.resourceType === RESOURCE_ENERGY
    });
  }

  protected findClosestLargeEnergyDrop(): Resource<RESOURCE_ENERGY> | null {
    return this.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
      filter: r => r.resourceType === RESOURCE_ENERGY && r.amount >= this.store.getCapacity()
    });
  }

  protected findClosestActiveEnergySource(): Source | undefined {
    return this.pos.findClosestByPath(FIND_SOURCES_ACTIVE, { ignoreCreeps: true }) ?? undefined;
  }

  protected findClosestEnergySource(): Source | undefined {
    return this.pos.findClosestByPath(FIND_SOURCES, { ignoreCreeps: true }) ?? undefined;
  }

  protected findClosestTowerNotFull(): StructureTower | null {
    return this.pos.findClosestByPath(FIND_MY_STRUCTURES, {
      filter: structure => {
        return structure.structureType === STRUCTURE_TOWER && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
      }
    });
  }

  protected findSpawnStorageNotFull(): (StructureExtension | StructureSpawn)[] {
    const spawns: (StructureExtension | StructureSpawn)[] = this.roomw.find(FIND_MY_SPAWNS, {
      filter: spawn => spawn.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    });
    const extensions: (StructureExtension | StructureSpawn)[] = this.roomw.find<StructureExtension>(
      FIND_MY_STRUCTURES,
      {
        filter: s => s.structureType === STRUCTURE_EXTENSION && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
      }
    );
    const spawnStorage = spawns.concat(extensions);
    return spawnStorage;
  }

  protected findDismantleTarget(): Structure | undefined {
    const dismantleQueue = this.roomw.dismantleQueue;
    if (dismantleQueue.length > 0) {
      return dismantleQueue[0];
    }
    return undefined;
  }

  protected withdrawAdjacentRuinOrTombEnergy(): ScreepsReturnCode {
    // can't withdraw twice, so prefer emptying tombstones because they decay faster
    let withdrawResult: ScreepsReturnCode = ERR_NOT_FOUND;
    const tombs = this.pos.findInRange(FIND_TOMBSTONES, 1, {
      filter: t => t.store.getUsedCapacity(RESOURCE_ENERGY) > 0
    });
    if (tombs.length > 0) {
      withdrawResult = this.withdrawW(tombs[0], RESOURCE_ENERGY);
    } else {
      const ruins = this.pos.findInRange(FIND_RUINS, 1, { filter: r => r.store.getUsedCapacity(RESOURCE_ENERGY) > 0 });
      if (ruins.length > 0) {
        withdrawResult = this.withdrawW(ruins[0], RESOURCE_ENERGY);
      }
    }
    return withdrawResult;
  }

  protected pickupAdjacentDroppedEnergy(): ScreepsReturnCode {
    let pickupResult: ScreepsReturnCode = ERR_NOT_FOUND;
    const resources = this.pos.findInRange(FIND_DROPPED_RESOURCES, 1, {
      filter: r => r.resourceType === RESOURCE_ENERGY
    });
    if (resources.length > 0) {
      pickupResult = this.pickupW(resources[0]);
    }
    return pickupResult;
  }

  /**
   * finds energy in room in order:
   * adjacent drop, ruin, or tomb
   * drop large enough to fill
   * storage
   * tomb
   * ruin
   * container with energy
   * active source
   * dismantle structure
   * move to inactive source
   */
  protected harvestByPriority(): ScreepsReturnCode {
    if (this.getActiveBodyparts(CARRY) === 0 || this.store.getFreeCapacity() === 0) {
      return ERR_FULL;
    }

    this.pickupAdjacentDroppedEnergy();
    this.withdrawAdjacentRuinOrTombEnergy();

    let result = this.moveToAndGet(this.findClosestLargeEnergyDrop());
    if (result === OK) {
      return result;
    }

    result = this.moveToAndGet(this.findClosestEnergyDrop());
    if (result === OK) {
      return result;
    }

    if (this.room.storage && this.room.storage.store.energy > 0) {
      result = this.moveToAndGet(this.room.storage);
      if (result === OK) {
        return result;
      }
    }

    result = this.moveToAndGet(this.findClosestTombstoneWithEnergy());
    if (result === OK) {
      return result;
    }

    result = this.moveToAndGet(this.findClosestRuinsWithEnergy());
    if (result === OK) {
      return result;
    }

    result = this.moveToAndGet(this.findClosestContainerWithEnergy(this.store.getFreeCapacity()));
    if (result === OK) {
      return result;
    }

    result = this.moveToAndGet(this.findClosestContainerWithEnergy());
    if (result === OK) {
      return result;
    }

    if (this.getActiveBodyparts(WORK) > 0) {
      result = this.moveToAndGet(this.findClosestActiveEnergySource());
      if (result === OK) {
        return result;
      }

      result = this.moveToAndDismantle(this.findDismantleTarget());
      if (result === OK) {
        return result;
      }

      const inactiveSource = this.findClosestEnergySource();
      if (inactiveSource && !this.pos.isNearTo(inactiveSource)) {
        result = this.moveToW(inactiveSource, { range: 1, visualizePathStyle: { stroke: "#ffaa00" } });
        CreepUtils.consoleLogIfWatched(this, `moving to inactive source: ${String(inactiveSource?.pos)}`, result);
        return result;
      }
    }

    this.say("🤔");
    CreepUtils.consoleLogIfWatched(this, `stumped. Just going to sit here.`);
    return ERR_NOT_FOUND;
  }

  protected findClosestControllerContainerNotFull(): StructureContainer | undefined {
    const containersNotFull = this.roomw.controllerContainers.filter(
      container => container.store.getFreeCapacity() > 0
    );
    CreepUtils.consoleLogIfWatched(this, `controller containers not full: ${containersNotFull.length}`);
    return this.pos.findClosestByPath(containersNotFull) ?? undefined;
  }

  protected pickupW(target: Resource<ResourceConstant>, force = false): ScreepsReturnCode {
    if (!this.pickingUp || force) {
      const result = this.pickup(target);
      if (result === OK) {
        this.pickingUpAmount = Math.min(target.amount, this.store.getFreeCapacity());
        this.pickingUp = true;
      }
      return result;
    }
    return ERR_BUSY;
  }

  protected withdrawW(
    target: StructureContainer | Tombstone | Ruin | StructureStorage,
    type: ResourceConstant,
    force = false
  ): ScreepsReturnCode {
    if (!this.withdrawing || force) {
      // only withdraw remaining capacity if also picking up drop this tick
      const targetAmount = target.store.getUsedCapacity(type);
      const withdrawAmount = Math.min(targetAmount, this.store.getFreeCapacity() - this.pickingUpAmount);
      const result = this.withdraw(target, type, withdrawAmount);
      if (result === OK) {
        this.withdrawing = true;
      }
      return result;
    }
    return ERR_BUSY;
  }

  protected moveToAndGet(
    target: Tombstone | Ruin | StructureContainer | StructureStorage | Resource | Source | null | undefined,
    resourceType: ResourceConstant = RESOURCE_ENERGY
  ): ScreepsReturnCode {
    if (!target) {
      return ERR_NOT_FOUND;
    }
    let result: ScreepsReturnCode;
    if (target.pos.isNearTo(this.pos)) {
      CreepUtils.consoleLogIfWatched(this, `getting: ${String(target)}`);
      if (target instanceof Resource) {
        result = this.pickupW(target);
      } else if (target instanceof Source) {
        result = this.harvest(target);
      } else {
        result = this.withdrawW(target, resourceType);
      }
      CreepUtils.consoleLogIfWatched(this, `get result`, result);
    } else {
      result = this.moveToW(target, {
        range: 1,
        visualizePathStyle: { stroke: "#ffaa00" }
      });
      CreepUtils.consoleLogIfWatched(this, `move result`, result);
    }
    return result;
  }

  protected moveToAndAttack(target: Creep | Structure): ScreepsReturnCode {
    let result: ScreepsReturnCode;
    if (target.pos.isNearTo(this.pos)) {
      result = this.attack(target);
      CreepUtils.consoleLogIfWatched(this, `attack ${typeof target}`, result);
      if (result === OK) {
        // don't heal when attacking, heal overrides the attack
        this.cancelOrder(HEAL);
      }
    } else {
      result = this.moveToW(target, {
        range: 1,
        visualizePathStyle: { stroke: "#ff0000" }
      });
      CreepUtils.consoleLogIfWatched(this, `move to ${typeof target}: ${String(target.pos)}`, result);
    }
    return result;
  }

  protected moveToRoom(roomName: string): ScreepsReturnCode {
    if (this.pos.roomName === roomName) {
      delete this.memory.path;
      CreepUtils.consoleLogIfWatched(this, `already in room ${roomName}`);
      return OK;
    }

    if (this.memory.path && this.memory.pathRoom !== this.room.name) {
      delete this.memory.path;
      delete this.memory.pathRoom;
    }

    if (this.memory.path) {
      this.clearPathIfStuck();
    }

    if (!this.memory.path) {
      CreepUtils.consoleLogIfWatched(this, `no stored path`);
    }

    if (this.memory.path?.length === 0) {
      CreepUtils.consoleLogIfWatched(this, `stored path is 0 steps`);
    }

    if (!this.memory.path || this.memory.path.length === 0) {
      CreepUtils.consoleLogIfWatched(this, `getting new path to room`);
      const result = this.getPathToRoom(roomName);
      if (result !== OK) {
        return result;
      }
    }

    if (this.memory.path) {
      const path = Room.deserializePath(this.memory.path);
      const ret = this.moveByPath(path);
      CreepUtils.consoleLogIfWatched(this, `moving to exit by path`, ret);
      return ret;
    }

    CreepUtils.consoleLogIfWatched(this, `no path found`);
    return ERR_NOT_FOUND;
  }

  protected getPathToRoom(roomName: string): ScreepsReturnCode {
    const exitDirection = this.roomw.findExitTo(roomName);
    if (exitDirection === ERR_NO_PATH || exitDirection === ERR_INVALID_ARGS) {
      CreepUtils.consoleLogIfWatched(this, `can't get to room: ${roomName}`, exitDirection);
      return exitDirection;
    }

    const exitPos = this.pos.findClosestByPath(exitDirection);
    if (!exitPos) {
      CreepUtils.consoleLogIfWatched(this, `can't find exit to room: ${roomName}`);
      return ERR_NO_PATH;
    }

    const path = this.pos.findPathTo(exitPos);
    this.memory.path = Room.serializePath(path);
    this.memory.pathRoom = this.room.name;
    return OK;
  }

  protected claimTargetRoom(): ScreepsReturnCode {
    if (this.room.name !== this.memory.targetRoom) {
      return ERR_NOT_IN_RANGE;
    }

    if (!this.roomw.controller) {
      return ERR_INVALID_TARGET;
    }

    if (
      (this.roomw.controller.owner && this.roomw.controller.owner.username !== Memory.username) ||
      (this.roomw.controller.reservation && this.roomw.controller.reservation.username !== Memory.username)
    ) {
      // go to controller and attack it
      let result: ScreepsReturnCode = this.attackController(this.roomw.controller);
      CreepUtils.consoleLogIfWatched(this, `attacking controller: ${String(this.roomw.controller.pos)}`, result);
      if (result === ERR_NOT_IN_RANGE) {
        result = this.moveToW(this.roomw.controller);
        CreepUtils.consoleLogIfWatched(this, `moving to controller: ${String(this.roomw.controller.pos)}`, result);
      }
      return result;
    }

    // go to controller and claim it
    let result: ScreepsReturnCode = this.claimController(this.roomw.controller);
    CreepUtils.consoleLogIfWatched(this, `claiming controller: ${String(this.roomw.controller.pos)}`, result);
    if (result === ERR_NOT_IN_RANGE) {
      result = this.moveToW(this.roomw.controller);
      CreepUtils.consoleLogIfWatched(this, `moving to controller: ${String(this.roomw.controller.pos)}`, result);
    }
    return result;
  }

  public calcWalkTime(path: PathFinderPath): number {
    let roadCount = 0;
    let plainCount = 0;
    let swampCount = 0;
    const terrain = this.creep.room.getTerrain();
    path.path.forEach(pos => {
      if (pos.lookFor(LOOK_STRUCTURES).filter(s => s.structureType === STRUCTURE_ROAD).length > 0) {
        roadCount++;
      } else if (terrain.get(pos.x, pos.y) === TERRAIN_MASK_SWAMP) {
        swampCount++;
      } else {
        plainCount++;
      }
    });

    const moveParts = this.body.filter(p => p.type === MOVE).length;
    const heavyParts = this.body.filter(p => p.type !== MOVE && p.type !== CARRY).length;
    const moveRatio = heavyParts / (moveParts * 2);

    const plainCost = Math.ceil(2 * moveRatio) * plainCount;
    const roadCost = Math.ceil(1 * moveRatio) * roadCount;
    const swampCost = Math.ceil(10 * moveRatio) * swampCount;

    return roadCost + plainCost + swampCost + 1;
  }

  public countParts(type: BodyPartConstant): number {
    return this.body.filter(part => part.type === type).length;
  }

  protected moveToRetiree(): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `moving to retiree`);
    const retireeName = this.memory.replacing as string;
    const retiree = Game.creeps[retireeName];
    if (retiree) {
      if (retiree.pos.isNearTo(this.pos)) {
        CreepUtils.consoleLogIfWatched(this, `requesting retirement of ${retiree.name}`);
        retiree.suicide();
      }
      return this.moveToW(retiree.pos, { visualizePathStyle: { stroke: "#ffaa00" } });
    } else {
      this.memory.replacing = undefined;
      return ERR_NOT_FOUND;
    }
  }

  protected findStructureForRepair(): Structure | undefined {
    // repair structures
    const structure = this.roomw.findClosestDamagedNonRoadNotWall(this.pos);
    if (structure) {
      return structure;
    }

    // repair roads
    const road = this.roomw.findClosestDamagedRoad(this.pos);
    if (road) {
      return road;
    }

    return undefined;
  }

  protected dismantleStructures(): ScreepsReturnCode {
    const target = this.findDismantleTarget();
    if (target) {
      return this.moveToAndDismantle(target);
    }
    return ERR_NOT_FOUND;
  }

  protected moveToAndRepair(structure: Structure<StructureConstant>): ScreepsReturnCode {
    if (this.pos.inRangeTo(structure, 3)) {
      const result: ScreepsReturnCode = this.repair(structure);
      CreepUtils.consoleLogIfWatched(this, `repairing ${structure.structureType}`, result);
      return result;
    }
    const result = this.moveToW(structure, {
      range: 3,
      costCallback: CostMatrixUtils.avoidHarvestPositionsAndCreepsCostCallback
    });
    CreepUtils.consoleLogIfWatched(this, `moving to ${String(structure.pos)}`, result);
    return result;
  }

  protected moveToAndDismantle(structure: Structure<StructureConstant> | undefined): ScreepsReturnCode {
    if (!structure) {
      return ERR_NOT_FOUND;
    }
    let result: ScreepsReturnCode = this.dismantle(structure);
    CreepUtils.consoleLogIfWatched(this, `dismantling ${structure.structureType}`, result);
    if (result === ERR_NOT_IN_RANGE) {
      CreepUtils.consoleLogIfWatched(this, `moving to ${String(structure.pos)}`, result);
      result = this.moveToW(structure, {
        costCallback: CostMatrixUtils.avoidHarvestPositionsAndCreepsCostCallback
      });
    }
    return result;
  }

  protected moveOffTheRoad(): ScreepsReturnCode {
    const onRoad = this.pos.lookFor(LOOK_STRUCTURES).some(item => item.structureType === STRUCTURE_ROAD);
    if (!onRoad) {
      return OK;
    }
    const path = PathFinder.search(
      this.pos,
      { pos: this.pos, range: 20 },
      {
        flee: true,
        plainCost: 0,
        swampCost: 10,
        roomCallback: CostMatrixUtils.creepMovementRoomCallback
      }
    );
    const result = this.moveByPath(path.path);
    CreepUtils.consoleLogIfWatched(this, `moving off the road`, result);
    return result;
  }

  /**
   * Finds a structure, or creep, that can accept energy from this creep's store.
   * Storage is found in order of storage, spawn, tower, controller container, or any other role creep with space.
   * @returns somewhere to dump energy
   */
  protected findRoomStorage(): StructureWithStorage | Creep | undefined {
    CreepUtils.consoleLogIfWatched(
      this,
      `room storage: ${String(this.room.storage)} ${String(this.room.storage?.store.getFreeCapacity())}`
    );
    if (this.room.storage && this.room.storage.store.getFreeCapacity() > 0) {
      CreepUtils.consoleLogIfWatched(this, `room storage: ${String(this.room.storage.store.getFreeCapacity())}`);
      return this.room.storage;
    }

    const spawnStorage = this.findSpawnStorageNotFull();
    if (spawnStorage) {
      const closestSpawnStorage = this.pos.findClosestByPath(spawnStorage);
      if (closestSpawnStorage) {
        CreepUtils.consoleLogIfWatched(this, `spawn storage: ${String(closestSpawnStorage.pos)}`);
        return closestSpawnStorage;
      }
    }

    const tower = this.findClosestTowerNotFull();
    if (tower) {
      CreepUtils.consoleLogIfWatched(this, `tower storage: ${String(tower.pos)}`);
      return tower;
    }

    const container = this.findClosestControllerContainerNotFull();
    if (container) {
      CreepUtils.consoleLogIfWatched(this, `container storage: ${String(container.pos)}`);
      return container;
    }

    const creepWithSpace = this.pos.findClosestByPath(
      this.roomw.creeps.filter(
        creep =>
          creep.id !== this.id &&
          [CreepRole.BUILDER, CreepRole.UPGRADER].includes(creep.memory.role) &&
          creep.store.getFreeCapacity() > 0
      )
    );
    if (creepWithSpace) {
      CreepUtils.consoleLogIfWatched(this, `creep with space: ${String(creepWithSpace)}`);
      return creepWithSpace;
    }

    return undefined;
  }

  /**
   * Moves to target and transfers a resource
   * By default, energy
   */
  protected moveToAndTransfer(
    target: StructureWithStorage | Creep,
    resourceType: ResourceConstant = RESOURCE_ENERGY
  ): ScreepsReturnCode {
    if (this.pos.isNearTo(target)) {
      const transferResult = this.transfer(target, resourceType);
      CreepUtils.consoleLogIfWatched(this, `transfer to ${String(target)}`, transferResult);
      return transferResult;
    } else {
      const moveResult = this.moveToW(target);
      CreepUtils.consoleLogIfWatched(this, `moving to ${String(target)} at ${String(target.pos)}`, moveResult);
      if (moveResult === OK) {
        return ERR_NOT_IN_RANGE;
      }
      return moveResult;
    }
  }

  /* Ability calculations */

  public get repairCost(): number {
    return REPAIR_POWER * REPAIR_COST * this.getActiveBodyparts(WORK);
  }

  public get repairAmount(): number {
    return REPAIR_POWER * this.getActiveBodyparts(WORK);
  }

  public get buildAmount(): number {
    return BUILD_POWER * this.getActiveBodyparts(WORK);
  }

  public get healAmount(): number {
    return HEAL_POWER * this.getActiveBodyparts(HEAL);
  }

  public get rangedHealAmount(): number {
    return RANGED_HEAL_POWER * this.getActiveBodyparts(HEAL);
  }

  public get harvestAmount(): number {
    return HARVEST_POWER * this.getActiveBodyparts(WORK);
  }

  public get rangedAttackAmount(): number {
    return RANGED_ATTACK_POWER * this.getActiveBodyparts(RANGED_ATTACK);
  }

  public get attackAmount(): number {
    return ATTACK_POWER * this.getActiveBodyparts(ATTACK);
  }

  public get upgradeAmount(): number {
    return UPGRADE_CONTROLLER_POWER * this.getActiveBodyparts(WORK);
  }

  public getStoreContents(): ResourceConstant[] {
    return CreepUtils.getStoreContents(this);
  }

  /** Task management */

  public assignTask(task: Task): void {
    this.memory.task = task;
    this.memory.working = false;
    this.memory.idleZone = undefined;
  }

  public hasTask(): boolean {
    return !!this.memory.task;
  }

  public getTask(): Task | undefined {
    return this.memory.task;
  }

  public completeTask(): void {
    CreepUtils.consoleLogIfWatched(this, `task complete: ${String(this.memory.task?.type)}`);
    delete this.memory.task;
    this.memory.working = false;
    this.memory.idleZone = undefined;
  }
}
