import { CreepRole } from "config/creep-types";
import { TargetControl } from "control/target-control";
import { Task } from "control/tasks/task";
import { TaskFactory } from "control/tasks/task-factory";
import { CreepUtils } from "creep-utils";
import { MemoryUtils } from "planning/memory-utils";
import { Stats, StatType } from "planning/stats";
import { RoomWrapper } from "structures/room-wrapper";
import { CostMatrixUtils } from "utils/cost-matrix-utils";
import { CreepBodyProfile } from "./creep-body-utils";

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

export interface CreepWrapperProfile {
  ROLE: CreepRole;
  BODY_PROFILE: CreepBodyProfile;
}

export abstract class CreepWrapper {
  private pickingUp = false;
  private withdrawing = false;
  private pickingUpAmount = 0;
  protected targetControl = TargetControl.getInstance();
  protected costMatrixUtils = CostMatrixUtils.getInstance();

  private creep: Creep;
  private readonly stats = new Stats();

  public constructor(creep: Creep) {
    this.creep = creep;
  }

  private init(): void {
    this.pickingUp = false;
    this.withdrawing = false;
    this.pickingUpAmount = 0;
  }

  public setCreep(creep: Creep): this {
    this.creep = creep;
    this.init();
    return this;
  }

  private getCreep(): Creep {
    return this.creep;
  }

  public get name(): string {
    return this.creep.name;
  }

  public get memory(): CreepMemory {
    return this.creep.memory;
  }

  public get pos(): RoomPosition {
    return this.creep.pos;
  }

  public get body(): BodyPartDefinition[] {
    return this.creep.body;
  }

  public get id(): Id<Creep> {
    return this.creep.id;
  }

  public get room(): RoomWrapper {
    return this.roomw;
  }

  public get roomw(): RoomWrapper {
    return RoomWrapper.getInstance(this.creep.room.name);
  }

  public get owner(): Owner {
    return this.creep.owner;
  }

  public get hits(): number {
    return this.creep.hits;
  }

  public get hitsMax(): number {
    return this.creep.hitsMax;
  }

  public get ticksToLive(): number | undefined {
    return this.creep.ticksToLive;
  }

  public get store(): StoreDefinition {
    return this.creep.store;
  }

  public getActiveBodyparts(type: BodyPartConstant): number {
    return this.creep.getActiveBodyparts(type);
  }

  public abstract run(): void;

  public moveTo(
    target: RoomObject | RoomPosition | CreepWrapper,
    moveOpts?: MoveToOpts
  ): ScreepsReturnCode {
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
      costCallback: this.costMatrixUtils.creepMovementCostCallback,
      ...moveOpts
    };
    return this.creep.moveTo(target, moveOpts);
  }

  public move(direction: DirectionConstant | CreepWrapper): ScreepsReturnCode {
    // check if stuck, even though we don't handle it with directional moves
    this.isStuck();
    if (direction instanceof CreepWrapper) {
      return this.creep.move(direction.getCreep());
    } else {
      return this.creep.move(direction);
    }
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
      if (this.creep.pos.isEqualTo(lastPos)) {
        this.memory.stuckCount = (this.memory.stuckCount ?? 0) + 1;
        this.roomw.visual.circle(this.pos.x, this.pos.y, { fill: "#000000" });
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
    return this.pos.findClosestByPath(FIND_TOMBSTONES, {
      filter: t => t.store.getUsedCapacity(RESOURCE_ENERGY) > 0
    });
  }

  /** find closest container with at least a minimum amount of energy */
  protected findClosestContainerWithEnergy(min = 0): StructureContainer | null {
    const container = this.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: s =>
        s.structureType === STRUCTURE_CONTAINER &&
        s.store.getUsedCapacity() > 0 &&
        s.store.energy > min
    });
    return container as StructureContainer;
  }

  /** find closest link with at least a minimum amount of energy */
  protected findClosestLinkWithEnergy(min = 0): StructureLink | null {
    const container = this.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: s =>
        s.structureType === STRUCTURE_LINK && s.store.getUsedCapacity(RESOURCE_ENERGY) > min
    });
    return container as StructureLink;
  }

  protected findClosestSourceContainer(): StructureContainer | null {
    const sources = this.roomw.find(FIND_SOURCES);
    const containers: StructureContainer[] = [];
    if (sources.length > 0) {
      for (const source of sources) {
        const container = source.pos.findInRange(FIND_STRUCTURES, 1, {
          filter: s => s.structureType === STRUCTURE_CONTAINER
        });
        if (container.length > 0) {
          containers.push(container[0]);
        }
      }
    }
    return this.pos.findClosestByPath(containers);
  }

  protected findClosestSourceContainerNotEmpty(): StructureContainer | null {
    const sources = this.roomw.find(FIND_SOURCES);
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
    return this.pos.findClosestByPath(FIND_RUINS, {
      filter: r => r.store.getUsedCapacity(RESOURCE_ENERGY) > 0
    });
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
        return (
          structure.structureType === STRUCTURE_TOWER &&
          structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        );
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
        filter: s =>
          s.structureType === STRUCTURE_EXTENSION && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
      }
    );
    const spawnStorage = spawns.concat(extensions);
    return spawnStorage;
  }

  protected findDismantleTarget(): Structure | undefined {
    return this.roomw.getDismantleTarget(this.pos);
  }

  protected withdrawAdjacentRuinOrTombEnergy(): ScreepsReturnCode {
    // can't withdraw twice, so prefer emptying tombstones because they decay faster
    let withdrawResult: ScreepsReturnCode = ERR_NOT_FOUND;
    const tombs = this.pos.findInRange(FIND_TOMBSTONES, 1, {
      filter: t => t.store.getUsedCapacity(RESOURCE_ENERGY) > 0
    });
    if (tombs.length > 0) {
      withdrawResult = this.withdraw(tombs[0], RESOURCE_ENERGY);
    } else {
      const ruins = this.pos.findInRange(FIND_RUINS, 1, {
        filter: r => r.store.getUsedCapacity(RESOURCE_ENERGY) > 0
      });
      if (ruins.length > 0) {
        withdrawResult = this.withdraw(ruins[0], RESOURCE_ENERGY);
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
      pickupResult = this.pickup(resources[0]);
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
   * link with energy
   * active source
   * dismantle structure
   * move to inactive source
   */
  public harvestByPriority(): ScreepsReturnCode {
    if (this.creep.getActiveBodyparts(CARRY) === 0 || this.store.getFreeCapacity() === 0) {
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

    if (this.roomw.storage && this.roomw.storage.store.energy > 0) {
      result = this.moveToAndGet(this.roomw.storage);
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

    result = this.moveToAndGet(this.findClosestLinkWithEnergy(this.store.getFreeCapacity() / 2));
    if (result === OK) {
      return result;
    }

    result = this.moveToAndGet(this.findClosestLinkWithEnergy());
    if (result === OK) {
      return result;
    }

    if (this.creep.getActiveBodyparts(WORK) > 0) {
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
        result = this.moveTo(inactiveSource, {
          range: 1,
          visualizePathStyle: { stroke: "#ffaa00" }
        });
        CreepUtils.consoleLogIfWatched(
          this,
          `moving to inactive source: ${String(inactiveSource?.pos)}`,
          result
        );
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
    CreepUtils.consoleLogIfWatched(
      this,
      `controller containers not full: ${containersNotFull.length}`
    );
    return this.pos.findClosestByPath(containersNotFull) ?? undefined;
  }

  /**
   * Wrappers of Creep methods
   * These allow CreepWrapper to be used as a Creep, with hooks into the Creep actions, without extending Creep (which breaks stuff sometimes)
   */

  public transfer(
    target: AnyCreep | Structure,
    resourceType: ResourceConstant = RESOURCE_ENERGY,
    amount?: number
  ): ScreepsReturnCode {
    return this.creep.transfer(target, resourceType, amount);
  }

  public pickup(target: Resource<ResourceConstant>, force = false): ScreepsReturnCode {
    if (!this.pickingUp || force) {
      const result = this.creep.pickup(target);
      if (result === OK) {
        this.pickingUpAmount = Math.min(target.amount, this.store.getFreeCapacity());
        this.pickingUp = true;
      }
      return result;
    }
    return ERR_BUSY;
  }

  public withdraw(
    target: StructureContainer | Tombstone | Ruin | StructureStorage | StructureLink,
    type: ResourceConstant,
    force = false
  ): ScreepsReturnCode {
    if (!this.withdrawing || force) {
      // only withdraw remaining capacity if also picking up drop this tick
      const targetAmount = target.store.getUsedCapacity(type) ?? 0;
      const withdrawAmount = Math.min(
        targetAmount,
        this.store.getFreeCapacity() - this.pickingUpAmount
      );
      const result = this.creep.withdraw(target, type, withdrawAmount);
      if (result === OK) {
        this.withdrawing = true;
      }
      return result;
    }
    return ERR_BUSY;
  }

  public harvest(target: Source): ScreepsReturnCode {
    const result = this.creep.harvest(target);
    if (result === OK) {
      this.stats.record(this.room.name, StatType.HARVEST_ENERGY_STAT, this.harvestAmount);
    }
    return result;
  }

  public repair(target: Structure): ScreepsReturnCode {
    const result = this.creep.repair(target);
    if (result === OK) {
      this.stats.record(this.room.name, StatType.REPAIR_STAT, this.repairCost);
    }
    return result;
  }

  public dismantle(target: Structure): ScreepsReturnCode {
    return this.creep.dismantle(target);
  }

  public moveByPath(path: PathStep[] | RoomPosition[] | string): ScreepsReturnCode {
    return this.creep.moveByPath(path);
  }

  public suicide(): ScreepsReturnCode {
    return this.creep.suicide();
  }

  public build(site: ConstructionSite<BuildableStructureConstant>): ScreepsReturnCode {
    const result = this.creep.build(site);
    if (result === OK) {
      this.stats.record(this.room.name, StatType.BUILD_STAT, this.buildCost);
    }
    return result;
  }

  public signController(controller: StructureController, message: string): ScreepsReturnCode {
    return this.creep.signController(controller, message);
  }

  public attackController(controller: StructureController): ScreepsReturnCode {
    return this.creep.attackController(controller);
  }

  public upgradeController(controller: StructureController): ScreepsReturnCode {
    const result = this.creep.upgradeController(controller);
    if (result === OK) {
      this.stats.record(this.room.name, StatType.UPGRADE_STAT, this.getActiveBodyparts(WORK));
    }
    return result;
  }

  public reserveController(controller: StructureController): ScreepsReturnCode {
    return this.creep.reserveController(controller);
  }

  public heal(target: CreepWrapper): ScreepsReturnCode {
    return this.creep.heal(target.getCreep());
  }

  public pull(creep: CreepWrapper): ScreepsReturnCode {
    return this.creep.pull(creep.getCreep());
  }

  public attack(target: Structure<StructureConstant> | AnyCreep): CreepActionReturnCode {
    return this.creep.attack(target);
  }

  public rangedAttack(target: Structure<StructureConstant> | AnyCreep): CreepActionReturnCode {
    return this.creep.rangedAttack(target);
  }

  public say(message: string): ScreepsReturnCode {
    return this.creep.say(message);
  }

  public moveToAndGet(
    target:
      | Tombstone
      | Ruin
      | StructureContainer
      | StructureLink
      | StructureStorage
      | Resource
      | Source
      | null
      | undefined,
    resourceType: ResourceConstant = RESOURCE_ENERGY
  ): ScreepsReturnCode {
    if (!target) {
      return ERR_NOT_FOUND;
    }
    let result: ScreepsReturnCode;
    if (target.pos.isNearTo(this.pos)) {
      CreepUtils.consoleLogIfWatched(this, `getting: ${String(target)}`);
      if (target instanceof Resource) {
        result = this.pickup(target);
      } else if (target instanceof Source) {
        result = this.harvest(target);
      } else {
        result = this.withdraw(target, resourceType);
      }
      CreepUtils.consoleLogIfWatched(this, `get result`, result);
    } else {
      result = this.moveTo(target, {
        range: 1,
        visualizePathStyle: { stroke: "#ffaa00" }
      });
      CreepUtils.consoleLogIfWatched(this, `move result`, result);
    }
    return result;
  }

  protected moveToAndAttack(target: Creep | Structure): ScreepsReturnCode {
    let result: ScreepsReturnCode;
    if (target.pos.isNearTo(this.pos) && this.getActiveBodyparts(ATTACK) > 0) {
      result = this.creep.attack(target);
      CreepUtils.consoleLogIfWatched(this, `attack ${typeof target}`, result);
      if (result === OK) {
        // don't heal when attacking, heal overrides the attack
        this.creep.cancelOrder(HEAL);
      }
    } else {
      result = this.creep.rangedAttack(target);
      if (result === ERR_NOT_IN_RANGE) {
        result = this.moveTo(target, {
          range: 1,
          visualizePathStyle: { stroke: "#ff0000" }
        });
        CreepUtils.consoleLogIfWatched(
          this,
          `move to ${typeof target}: ${String(target.pos)}`,
          result
        );
      }
    }
    return result;
  }

  protected moveToRoom(roomName: string): ScreepsReturnCode {
    if (this.roomw.name === roomName) {
      delete this.memory.path;
      delete this.memory.pathRoom;
      CreepUtils.consoleLogIfWatched(this, `already in room ${roomName}`);
      return OK;
    }

    if (this.memory.path && this.memory.pathRoom !== roomName) {
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
      const ret = this.creep.moveByPath(path);
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
    CreepUtils.consoleLogIfWatched(this, `exit direction: ${exitDirection}`);

    const exitPos = this.pos.findClosestByPath(exitDirection);
    if (!exitPos) {
      CreepUtils.consoleLogIfWatched(this, `can't find exit to room: ${roomName}`);
      return ERR_NO_PATH;
    }
    CreepUtils.consoleLogIfWatched(
      this,
      `exit position: ${String(exitPos)}, current pos: ${String(this.pos)}`
    );

    const path = this.pos.findPathTo(exitPos, { maxOps: 5000 });
    CreepUtils.consoleLogIfWatched(this, `path found: ${JSON.stringify(path)}`);
    const serializedPath = Room.serializePath(path);
    CreepUtils.consoleLogIfWatched(this, `path serialized: ${serializedPath}`);
    this.memory.path = serializedPath;
    this.memory.pathRoom = this.roomw.name;
    return OK;
  }

  protected claimTargetRoom(): ScreepsReturnCode {
    if (this.roomw.name !== this.memory.targetRoom) {
      return ERR_NOT_IN_RANGE;
    }

    if (!this.roomw.controller) {
      return ERR_INVALID_TARGET;
    }

    if (
      (this.roomw.controller.owner && this.roomw.controller.owner.username !== Memory.username) ||
      (this.roomw.controller.reservation &&
        this.roomw.controller.reservation.username !== Memory.username)
    ) {
      // go to controller and attack it
      let result: ScreepsReturnCode = this.creep.attackController(this.roomw.controller);
      CreepUtils.consoleLogIfWatched(
        this,
        `attacking controller: ${String(this.roomw.controller.pos)}`,
        result
      );
      if (result === ERR_NOT_IN_RANGE) {
        result = this.moveTo(this.roomw.controller);
        CreepUtils.consoleLogIfWatched(
          this,
          `moving to controller: ${String(this.roomw.controller.pos)}`,
          result
        );
      }
      return result;
    }

    // go to controller and claim it
    let result: ScreepsReturnCode = this.creep.claimController(this.roomw.controller);
    CreepUtils.consoleLogIfWatched(
      this,
      `claiming controller: ${String(this.roomw.controller.pos)}`,
      result
    );
    if (result === ERR_NOT_IN_RANGE) {
      result = this.moveTo(this.roomw.controller);
      CreepUtils.consoleLogIfWatched(
        this,
        `moving to controller: ${String(this.roomw.controller.pos)}`,
        result
      );
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

  protected moveToRetiree(): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `moving to retiree`);
    const retireeName = this.memory.replacing as string;
    const retiree = Game.creeps[retireeName];
    if (retiree) {
      if (retiree.pos.isNearTo(this.pos)) {
        CreepUtils.consoleLogIfWatched(this, `requesting retirement of ${retiree.name}`);
        retiree.suicide();
      }
      return this.moveTo(retiree.pos, { visualizePathStyle: { stroke: "#ffaa00" } });
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
    const road = this.roomw.findClosestDamagedRoad(this.pos, 0.5);
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
    const result = this.moveTo(structure, {
      range: 3,
      costCallback: this.costMatrixUtils.avoidHarvestPositionsAndCreepsCostCallback
    });
    CreepUtils.consoleLogIfWatched(this, `moving to ${String(structure.pos)}`, result);
    return result;
  }

  protected moveToAndDismantle(
    structure: Structure<StructureConstant> | undefined
  ): ScreepsReturnCode {
    if (!structure) {
      return ERR_NOT_FOUND;
    }
    let result: ScreepsReturnCode = this.dismantle(structure);
    CreepUtils.consoleLogIfWatched(this, `dismantling ${structure.structureType}`, result);
    if (result === ERR_NOT_IN_RANGE) {
      CreepUtils.consoleLogIfWatched(this, `moving to ${String(structure.pos)}`, result);
      result = this.moveTo(structure, {
        costCallback: this.costMatrixUtils.avoidHarvestPositionsAndCreepsCostCallback
      });
    }
    return result;
  }

  protected moveOffTheRoad(): ScreepsReturnCode {
    const onRoad = this.pos
      .lookFor(LOOK_STRUCTURES)
      .some(item => item.structureType === STRUCTURE_ROAD);
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
        roomCallback: this.costMatrixUtils.creepMovementRoomCallback
      }
    );
    const result = this.creep.moveByPath(path.path);
    CreepUtils.consoleLogIfWatched(this, `moving off the road`, result);
    return result;
  }

  /**
   * Finds a structure, or creep, that can accept energy from this creep's store.
   * Storage is found in order of storage, spawn, tower, controller container, or any other role creep with space.
   * @returns somewhere to dump energy
   */
  public findRoomStorage(): StructureWithStorage | Creep | undefined {
    CreepUtils.consoleLogIfWatched(
      this,
      `room storage: ${String(this.roomw.storage)} ${String(
        this.roomw.storage?.store.getFreeCapacity()
      )}`
    );
    if (this.roomw.storage && this.roomw.storage.store.getFreeCapacity() > 0) {
      CreepUtils.consoleLogIfWatched(
        this,
        `room storage: ${String(this.roomw.storage.store.getFreeCapacity())}`
      );
      return this.roomw.storage;
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
  public moveToAndTransfer(
    target: StructureWithStorage | Creep,
    resourceType: ResourceConstant = RESOURCE_ENERGY
  ): ScreepsReturnCode {
    if (this.pos.isNearTo(target)) {
      const transferResult = this.transfer(target, resourceType);
      CreepUtils.consoleLogIfWatched(this, `transfer to ${String(target)}`, transferResult);
      return transferResult;
    } else {
      const moveResult = this.moveTo(target);
      CreepUtils.consoleLogIfWatched(
        this,
        `moving to ${String(target)} at ${String(target.pos)}`,
        moveResult
      );
      if (moveResult === OK) {
        return ERR_NOT_IN_RANGE;
      }
      return moveResult;
    }
  }

  /* Ability calculations */

  public get repairCost(): number {
    return REPAIR_POWER * REPAIR_COST * this.creep.getActiveBodyparts(WORK);
  }

  public get repairAmount(): number {
    return REPAIR_POWER * this.creep.getActiveBodyparts(WORK);
  }

  public get buildAmount(): number {
    return BUILD_POWER * this.creep.getActiveBodyparts(WORK);
  }

  public get buildCost(): number {
    return this.buildAmount;
  }

  public get healAmount(): number {
    return HEAL_POWER * this.creep.getActiveBodyparts(HEAL);
  }

  public get rangedHealAmount(): number {
    return RANGED_HEAL_POWER * this.creep.getActiveBodyparts(HEAL);
  }

  public get harvestAmount(): number {
    return HARVEST_POWER * this.creep.getActiveBodyparts(WORK);
  }

  public get rangedAttackAmount(): number {
    return RANGED_ATTACK_POWER * this.creep.getActiveBodyparts(RANGED_ATTACK);
  }

  public get attackAmount(): number {
    return ATTACK_POWER * this.creep.getActiveBodyparts(ATTACK);
  }

  public get upgradeAmount(): number {
    return UPGRADE_CONTROLLER_POWER * this.creep.getActiveBodyparts(WORK);
  }

  public getStoreContents(): ResourceConstant[] {
    return CreepUtils.getStoreContents(this.store);
  }

  public isEmpty(): boolean {
    return this.store.getUsedCapacity() === 0;
  }

  public isFull(): boolean {
    return this.store.getFreeCapacity() === 0;
  }

  public hasResource(resourceType: ResourceConstant): boolean {
    return this.store.getUsedCapacity(resourceType) !== 0;
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
    const task = this.memory.task;
    if (task) {
      return TaskFactory.create(task);
    }
    return undefined;
  }

  public completeTask(): void {
    CreepUtils.consoleLogIfWatched(this, `task complete: ${String(this.memory.task?.type)}`);
    delete this.memory.task;
    this.memory.working = false;
    this.memory.idleZone = undefined;
  }

  /**
   * Dismantle work flow
   * Dismantles the target structure. Stops if full, returns to work after depositing in storage.
   */
  protected doDismantleJob(target: Structure): ScreepsReturnCode {
    this.updateJob("dismantle?");
    this.startWorkingInRange(target.pos, 1);
    this.startWorkingIfEmpty();
    this.stopWorkingIfFull();

    if (this.memory.working) {
      const result = this.moveToAndDismantle(target);
      CreepUtils.consoleLogIfWatched(this, `dismantle result`, result);
      return result;
    } else {
      const storage = this.findRoomStorage();
      if (storage) {
        const result = this.moveToAndTransfer(storage);
        return result;
      }
      return ERR_FULL;
    }
  }
}
