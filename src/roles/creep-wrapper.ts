import { CreepUtils } from "creep-utils";
import { MemoryUtils } from "planning/memory-utils";
import { RoomWrapper } from "structures/room-wrapper";
import { Constants } from "../constants";

export abstract class CreepWrapper extends Creep {
  public constructor(private readonly creep: Creep) {
    super(creep.id);
  }

  public abstract run(): void;

  public get roomw(): RoomWrapper {
    return new RoomWrapper(this.room);
  }

  protected updateJob(job: string): void {
    if (this.memory.job !== job) {
      this.memory.job = job;
      this.say(job);
    }
  }

  protected stopWorkingIfEmpty(): void {
    if (this.memory.working && this.store[RESOURCE_ENERGY] === 0) {
      CreepUtils.consoleLogIfWatched(this, "stop working, empty");
      this.memory.working = false;
      this.say("🔄 harvest");
    }
  }

  protected startWorkingIfFull(message: string): void {
    const freeCap = this.store.getFreeCapacity();
    CreepUtils.consoleLogIfWatched(this, `full check: working: ${String(this.memory.working)}, free cap: ${freeCap}`);
    if (!this.memory.working && freeCap === 0) {
      CreepUtils.consoleLogIfWatched(this, "start working, full");
      this.memory.working = true;
      this.say(message);
    }
  }

  protected workIfCloseToJobsite(jobsite: RoomPosition, range = 3): void {
    // skip check if full/empty
    if (this.store.getUsedCapacity() !== 0 && this.store.getFreeCapacity() !== 0) {
      // skip check if can work from here
      if (this.pos.inRangeTo(jobsite, range)) {
        return;
      }
      // skip check if no source or next to source already
      const source = this.findClosestActiveEnergySource();
      if (!source || this.pos.isNearTo(source)) {
        return;
      }

      // calculate efficiency of heading back to refill, then going to job site
      const sourceCost = PathFinder.search(this.pos, { pos: source.pos, range: 1 }).cost;
      CreepUtils.consoleLogIfWatched(this, `sourceCost: ${sourceCost}`);
      // subtract one from runCost because you cannot stand on the source
      let runCost = PathFinder.search(source.pos, { pos: jobsite, range }).cost;
      if (runCost > 1) {
        runCost = runCost - 1;
      }
      const refillEfficiency = sourceCost + runCost;
      CreepUtils.consoleLogIfWatched(this, `runCost: ${runCost}, refillEfficiency: ${refillEfficiency}`);

      // calculate efficiency of going to job site partially full
      const jobsiteCost = PathFinder.search(this.pos, { pos: jobsite, range }).cost;
      const storeRatio = this.store.getUsedCapacity() / this.store.getCapacity();
      const jobsiteEfficiency = jobsiteCost / storeRatio;
      CreepUtils.consoleLogIfWatched(
        this,
        `jobsiteCost: ${jobsiteCost}, storeRatio: ${storeRatio}, jobsiteEfficiency: ${jobsiteEfficiency}`
      );

      // compare cost/energy delivered working vs refilling first
      if (jobsiteEfficiency < refillEfficiency) {
        CreepUtils.consoleLogIfWatched(this, `close to site: starting work`);
        this.memory.working = true;
      } else {
        CreepUtils.consoleLogIfWatched(this, `close to source: stopping work`);
        this.memory.working = false;
      }
    } else {
      CreepUtils.consoleLogIfWatched(this, `skip jobsite check`);
    }
  }

  protected findClosestTombstoneWithEnergy(): Tombstone | null {
    return this.pos.findClosestByPath(FIND_TOMBSTONES, { filter: t => t.store.getUsedCapacity(RESOURCE_ENERGY) > 0 });
  }

  protected findClosestContainerWithEnergy(min = 0): StructureContainer | null {
    const container = this.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_CONTAINER && s.store.getUsedCapacity() > 0 && s.store.energy > min
    });
    return container as StructureContainer;
  }

  protected findClosestRuinsWithEnergy(): Ruin | null {
    return this.pos.findClosestByPath(FIND_RUINS, { filter: r => r.store.getUsedCapacity(RESOURCE_ENERGY) > 0 });
  }

  protected findClosestDroppedEnergy(): Resource<RESOURCE_ENERGY> | null {
    return this.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
      filter: r => r.resourceType === RESOURCE_ENERGY
    }) as Resource<RESOURCE_ENERGY>;
  }

  protected findClosestActiveEnergySource(): Source | null {
    return this.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
  }

  protected findClosestEnergySource(): Source | null {
    let source = this.pos.findClosestByPath(FIND_SOURCES);
    if (!source) {
      source = this.pos.findClosestByRange(FIND_SOURCES);
    }
    return source;
  }

  protected findClosestTowerNotFull(): StructureTower | null {
    return this.pos.findClosestByPath(FIND_MY_STRUCTURES, {
      filter: structure => {
        return structure.structureType === STRUCTURE_TOWER && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
      }
    }) as StructureTower | null;
  }

  protected findClosestSpawnStorageNotFull(): StructureSpawn | StructureExtension | null {
    return this.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: structure => {
        return (
          (structure.structureType === STRUCTURE_EXTENSION || structure.structureType === STRUCTURE_SPAWN) &&
          structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        );
      }
    }) as StructureSpawn | StructureExtension | null;
  }

  protected harvestByPriority(): void {
    // harvest if adjacent to tombstone or ruin
    const tombstone = this.findClosestTombstoneWithEnergy();
    if (tombstone && this.withdraw(tombstone, RESOURCE_ENERGY) === OK) {
      return;
    }
    const ruin = this.findClosestRuinsWithEnergy();
    if (ruin && this.withdraw(ruin, RESOURCE_ENERGY) === OK) {
      return;
    }
    const resource = this.findClosestDroppedEnergy();
    if (resource) {
      this.pickup(resource);
    }

    const container = this.findClosestContainerWithEnergy(this.store.getFreeCapacity());
    if (container) {
      CreepUtils.consoleLogIfWatched(this, `moving to container: ${container.pos.x},${container.pos.y}`);
      const result = this.withdrawEnergyFromOrMoveTo(container);
      if (result !== ERR_NO_PATH) {
        return;
      }
    }

    const activeSource = this.findClosestActiveEnergySource();
    if (activeSource && this.harvestEnergyFromOrMoveTo(activeSource) !== ERR_NO_PATH) {
      return;
    }

    if (tombstone) {
      CreepUtils.consoleLogIfWatched(this, `moving to tombstone: ${tombstone.pos.x},${tombstone.pos.y}`);
      const result = this.withdrawEnergyFromOrMoveTo(tombstone);
      if (result !== ERR_NO_PATH) {
        return;
      }
    }

    if (ruin) {
      CreepUtils.consoleLogIfWatched(this, `moving to ruin: ${ruin.pos.x},${ruin.pos.y}`);
      const result = this.withdrawEnergyFromOrMoveTo(ruin);
      if (result !== ERR_NO_PATH) {
        return;
      }
    }

    const inactiveSource = this.findClosestEnergySource();
    CreepUtils.consoleLogIfWatched(
      this,
      `moving to inactive source: ${String(inactiveSource?.pos.x)},${String(inactiveSource?.pos.y)}`
    );
    if (inactiveSource) {
      this.moveTo(inactiveSource, { visualizePathStyle: { stroke: "#ffaa00" } });
      return;
    }

    this.say("🤔");
    CreepUtils.consoleLogIfWatched(this, `stumped. Just going to sit here.`);
  }

  protected withdrawEnergyFromOrMoveTo(structure: Tombstone | Ruin | StructureContainer): ScreepsReturnCode {
    let result = this.withdraw(structure, RESOURCE_ENERGY);
    CreepUtils.consoleLogResultIfWatched(this, `withdraw result`, result);
    if (result === ERR_NOT_IN_RANGE) {
      result = this.moveTo(structure, { range: 1, visualizePathStyle: { stroke: "#ffaa00" } });
      CreepUtils.consoleLogResultIfWatched(this, `move result`, result);
      if (result === OK) {
        result = this.withdraw(structure, RESOURCE_ENERGY);
        CreepUtils.consoleLogResultIfWatched(this, `second withdraw result`, result);
      }
    }
    return result;
  }

  protected pickupFromOrMoveTo(resource: Resource): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `moving to ${typeof resource}: ${resource.pos.x},${resource.pos.y}`);
    let result: ScreepsReturnCode = this.pickup(resource);
    if (result === ERR_NOT_IN_RANGE) {
      result = this.moveTo(resource, { range: 1, visualizePathStyle: { stroke: "#ffaa00" } });
      if (result === OK) {
        result = this.pickup(resource);
      }
    }
    return result;
  }

  protected harvestEnergyFromOrMoveTo(source: Source): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `moving to ${typeof source}: ${source.pos.x},${source.pos.y}`);
    let result: ScreepsReturnCode = this.harvest(source);
    if (result === ERR_NOT_IN_RANGE) {
      result = this.moveTo(source, { range: 1, visualizePathStyle: { stroke: "#ffaa00" } });
      if (result === OK) {
        result = this.harvest(source);
      }
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

  protected touchRoad(): void {
    const onRoad = this.pos.lookFor(LOOK_STRUCTURES).filter(s => s.structureType === STRUCTURE_ROAD).length > 0;
    if (onRoad) {
      const roadUseLog = this.room.memory.roadUseLog;
      if (!roadUseLog) {
        this.room.memory.roadUseLog = {};
      }
      let timesUsed = this.room.memory.roadUseLog[`${this.pos.x},${this.pos.y}`];
      if (!timesUsed) {
        timesUsed = 0;
      }
      this.room.memory.roadUseLog[`${this.pos.x},${this.pos.y}`] = timesUsed + 1;
    }
  }

  public countParts(type: BodyPartConstant): number {
    return this.body.filter(part => part.type === type).length;
  }

  protected moveToMyContainer(): ScreepsReturnCode {
    const container = this.getMyContainer();
    CreepUtils.consoleLogIfWatched(this, `moving to container: ${String(container)}`);
    if (container) {
      return this.moveTo(container, { visualizePathStyle: { stroke: "#ffaa00" } });
    }
    return ERR_NOT_FOUND;
  }

  protected claimFreeSourceContainerAsMinder(): ScreepsReturnCode {
    MemoryUtils.refreshContainerMemory(this.room);
    const containerInfo = this.room.memory.containers.find(info => info.nearSource && !info.minderId);
    if (containerInfo) {
      containerInfo.minderId = this.id;
      this.memory.containerId = containerInfo.containerId as Id<StructureContainer>;
      return OK;
    }
    return ERR_NOT_FOUND;
  }

  protected claimFreeControllerContainerAsMinder(): ScreepsReturnCode {
    MemoryUtils.refreshContainerMemory(this.room);
    const containerInfo = this.room.memory.containers.find(info => info.nearController && !info.minderId);
    if (containerInfo) {
      containerInfo.minderId = this.id;
      this.memory.containerId = containerInfo.containerId as Id<StructureContainer>;
      return OK;
    }
    return ERR_NOT_FOUND;
  }

  protected get onMyContainer(): boolean {
    const container = this.getMyContainer();
    return !!container && this.pos.isEqualTo(container.pos);
  }

  protected moveToRetiree(): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `moving to retiree`);
    const retireeName = this.memory.retiree as string;
    const retiree = Game.creeps[retireeName];
    if (retiree) {
      return this.moveTo(retiree.pos, { visualizePathStyle: { stroke: "#ffaa00" } });
    } else {
      this.memory.retiree = undefined;
      return ERR_NOT_FOUND;
    }
  }

  protected getMyContainer(): StructureContainer | null {
    if (this.memory.containerId) {
      const container = Game.getObjectById(this.memory.containerId);
      if (!container) {
        CreepUtils.consoleLogIfWatched(this, `container id invalid`);
        this.memory.containerId = undefined;
      }
      return container;
    }
    return null;
  }

  protected repairStructures(): ScreepsReturnCode {
    // repair walls
    const wall = this.roomw.findWeakestWall();
    if (wall) {
      return this.moveToAndRepair(wall);
    }

    // repair structures
    const structure = this.roomw.findClosestDamagedNonRoad(this.pos);
    if (structure) {
      return this.moveToAndRepair(structure);
    }

    // repair roads
    const road = this.roomw.findClosestDamagedRoad(this.pos);
    if (road) {
      return this.moveToAndRepair(road);
    }

    return ERR_NOT_FOUND;
  }

  protected dismantleStructures(): ScreepsReturnCode {
    const dismantleQueue = this.roomw.dismantleQueue;
    if (dismantleQueue.length > 0) {
      return this.moveToAndDismantle(dismantleQueue[0]);
    }
    return ERR_NOT_FOUND;
  }

  private moveToAndRepair(structure: Structure<StructureConstant>): ScreepsReturnCode {
    let result: ScreepsReturnCode = this.repair(structure);
    CreepUtils.consoleLogResultIfWatched(this, `repairing ${structure.structureType}`, result);
    if (result === ERR_NOT_IN_RANGE) {
      CreepUtils.consoleLogResultIfWatched(this, `moving to ${String(structure.pos)}`, result);
      result = this.moveTo(structure, {
        costCallback: (roomName, costMatrix) => {
          this.roomw.getCostMatrix("avoidHarvestPositions", costMatrix);
        }
      });
    }
    return result;
  }

  private moveToAndDismantle(structure: Structure<StructureConstant>): ScreepsReturnCode {
    let result: ScreepsReturnCode = this.dismantle(structure);
    CreepUtils.consoleLogResultIfWatched(this, `dismantling ${structure.structureType}`, result);
    if (result === ERR_NOT_IN_RANGE) {
      CreepUtils.consoleLogResultIfWatched(this, `moving to ${String(structure.pos)}`, result);
      result = this.moveTo(structure, {
        costCallback: (roomName, costMatrix) => {
          this.roomw.getCostMatrix("avoidHarvestPositions", costMatrix);
        }
      });
    }
    return result;
  }

  /* Ability calculations */

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
}
