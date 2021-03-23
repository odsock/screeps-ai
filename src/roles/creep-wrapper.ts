import { CreepUtils } from "creep-utils";
import { RoomWrapper } from "structures/room-wrapper";

export class CreepWrapper extends Creep {
  constructor(private readonly creep: Creep) {
    super(creep.id);
  }

  public run() {
    this.touchRoad();
  }

  get roomw(): RoomWrapper {
    return new RoomWrapper(this.room);
  }

  protected updateJob(job: string) {
    if (this.memory.job != job) {
      this.memory.job = job;
      this.say(job);
    }
  }

  protected stopWorkingIfEmpty() {
    if (this.memory.working && this.store[RESOURCE_ENERGY] == 0) {
      CreepUtils.consoleLogIfWatched(this, 'stop working, empty');
      this.memory.working = false;
      this.say('🔄 harvest');
    }
  }

  protected startWorkingIfFull(message: string) {
    if (!this.memory.working && this.store.getFreeCapacity() == 0) {
      CreepUtils.consoleLogIfWatched(this, 'start working, full');
      this.memory.working = true;
      this.say(message);
    }
  }

  protected workIfCloseToJobsite(jobsite: RoomPosition, range = 3) {
    // skip check if full/empty
    if (this.store.getUsedCapacity() != 0 && this.store.getFreeCapacity() != 0) {
      // skip check if can work from here
      if (this.pos.inRangeTo(jobsite, range)) {
        return;
      }
      // skip check if no source or next to source already
      const source = this.findClosestActiveEnergySource();
      if (!source || this.pos.isNearTo(source)) {
        return;
      }

      // calculate effiency of heading back to refill, then going to job site
      const sourceCost = PathFinder.search(this.pos, { pos: source.pos, range: 1 }).cost;
      CreepUtils.consoleLogIfWatched(this, `sourceCost: ${sourceCost}`);
      // subtract one from runCost because you cannot stand on the source
      let runCost = PathFinder.search(source.pos, { pos: jobsite, range: range }).cost;
      if (runCost > 1) {
        runCost = runCost - 1;
      }
      const refillEfficiency = sourceCost + runCost;
      CreepUtils.consoleLogIfWatched(this, `runCost: ${runCost}, refillEfficiency: ${refillEfficiency}`);

      // calculate effiency of going to job site partially full
      const jobsiteCost = PathFinder.search(this.pos, { pos: jobsite, range: range }).cost;
      const storeRatio = this.store.getUsedCapacity() / this.store.getCapacity();
      const jobsiteEfficiency = jobsiteCost / storeRatio;
      CreepUtils.consoleLogIfWatched(this, `jobsiteCost: ${jobsiteCost}, storeRatio: ${storeRatio}, jobsiteEfficiency: ${jobsiteEfficiency}`);

      // compare cost/energy delivered working vs refilling first
      if (jobsiteEfficiency < refillEfficiency) {
        CreepUtils.consoleLogIfWatched(this, `close to site: starting work`);
        this.memory.working = true;
      }
      else {
        CreepUtils.consoleLogIfWatched(this, `close to source: stopping work`);
        this.memory.working = false;
      }
    }
  }

  protected findClosestTombstoneWithEnergy(): Tombstone | null {
    return this.pos.findClosestByPath(FIND_TOMBSTONES, { filter: (t) => t.store.getUsedCapacity(RESOURCE_ENERGY) > 0 });
  }

  protected findClosestContainerWithEnergy(): StructureContainer | null {
    let container = this.pos.findClosestByPath(FIND_STRUCTURES, { filter: (s) => s.structureType == STRUCTURE_CONTAINER && s.store.getUsedCapacity() > 0 });
    return container as StructureContainer;
  }

  protected findClosestRuinsWithEnergy(): Ruin | null {
    return this.pos.findClosestByPath(FIND_RUINS, { filter: (r) => r.store.getUsedCapacity(RESOURCE_ENERGY) > 0 });
  }

  protected findClosestDroppedEnergy(): Resource<RESOURCE_ENERGY> | null {
    return this.pos.findClosestByPath(FIND_DROPPED_RESOURCES, { filter: (r) => r.resourceType == RESOURCE_ENERGY }) as Resource<RESOURCE_ENERGY>;
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
      filter: (structure) => {
        return structure.structureType == STRUCTURE_TOWER && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
      }
    }) as StructureTower | null;
  }

  protected findClosestEnergyStorageNotFull(): AnyStructure | null {
    return this.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: (structure) => {
        return (structure.structureType == STRUCTURE_EXTENSION ||
          structure.structureType == STRUCTURE_SPAWN) &&
          structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
      }
    });
  }

  protected harvestByPriority(): void {
    // harvest if adjacent to tombstone or ruin
    let tombstone = this.findClosestTombstoneWithEnergy();
    if (tombstone && this.withdraw(tombstone, RESOURCE_ENERGY) == OK) {
      return;
    }
    let ruin = this.findClosestRuinsWithEnergy();
    if (ruin && this.withdraw(ruin, RESOURCE_ENERGY) == OK) {
      return;
    }
    const resource = this.findClosestDroppedEnergy();
    if(resource) {
      this.pickup(resource);
    }

    let container = this.findClosestContainerWithEnergy();
    if (container && this.withdrawEnergyFromOrMoveTo(container) != ERR_NO_PATH) {
      return;
    }

    let activeSource = this.findClosestActiveEnergySource();
    if (activeSource && this.harvestEnergyFromOrMoveTo(activeSource) != ERR_NO_PATH) {
      return;
    }

    if (tombstone && this.withdrawEnergyFromOrMoveTo(tombstone) != ERR_NO_PATH) {
      return;
    }

    if (ruin && this.withdrawEnergyFromOrMoveTo(ruin) != ERR_NO_PATH) {
      return;
    }

    let inactiveSource = this.findClosestEnergySource();
    CreepUtils.consoleLogIfWatched(this, `moving to inactive source: ${inactiveSource?.pos.x},${inactiveSource?.pos.y}`);
    if (inactiveSource) {
      this.moveTo(inactiveSource, { visualizePathStyle: { stroke: '#ffaa00' } });
      return;
    }

    this.say('🤔');
    CreepUtils.consoleLogIfWatched(this, `stumped. Just going to sit here.`);
  }

  protected withdrawEnergyFromOrMoveTo(structure: Tombstone | Ruin | StructureContainer): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `moving to ${typeof structure}: ${structure.pos.x},${structure.pos.y}`);
    let result = this.withdraw(structure, RESOURCE_ENERGY);
    if (result == ERR_NOT_IN_RANGE) {
      result = this.moveTo(structure, { range: 1, visualizePathStyle: { stroke: '#ffaa00' } });
      if (result == OK) {
        result = this.withdraw(structure, RESOURCE_ENERGY);
      }
    }
    return result;
  }

  protected pickupFromOrMoveTo(resource: Resource): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `moving to ${typeof resource}: ${resource.pos.x},${resource.pos.y}`);
    let result: ScreepsReturnCode = this.pickup(resource);
    if (result == ERR_NOT_IN_RANGE) {
      result = this.moveTo(resource, { range: 1, visualizePathStyle: { stroke: '#ffaa00' } });
      if (result == OK) {
        result = this.pickup(resource);
      }
    }
    return result;
  }

  protected harvestEnergyFromOrMoveTo(source: Source): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `moving to ${typeof source}: ${source.pos.x},${source.pos.y}`);
    let result: ScreepsReturnCode = this.harvest(source);
    if (result == ERR_NOT_IN_RANGE) {
      result = this.moveTo(source, { range: 1, visualizePathStyle: { stroke: '#ffaa00' } });
      if (result == OK) {
        result = this.harvest(source);
      }
    }
    return result;
  }

  public calcWalkTime(path: PathFinderPath): number {
    let roadCount = 0;
    let plainCount = 0;
    let spwampCount = 0;
    const terrain = this.creep.room.getTerrain();
    path.path.forEach((pos) => {
      if (pos.lookFor(LOOK_STRUCTURES).filter((s) => s.structureType == STRUCTURE_ROAD).length > 0) {
        roadCount++;
      }
      else if (terrain.get(pos.x, pos.y) == TERRAIN_MASK_SWAMP) {
        spwampCount++;
      }
      else {
        plainCount++;
      }
    });

    const moveParts = this.body.filter((p) => p.type == MOVE).length;
    const heavyParts = this.body.filter((p) => p.type != MOVE && p.type != CARRY).length;
    const moveRatio = heavyParts / (moveParts * 2);

    const plainCost = Math.ceil(2 * moveRatio) * plainCount;
    const roadCost = Math.ceil(1 * moveRatio) * roadCount;
    const spwampCost = Math.ceil(10 * moveRatio) * spwampCount;

    return roadCost + plainCost + spwampCost + 1;
  }

  protected touchRoad() {
    const onRoad = this.pos.lookFor(LOOK_STRUCTURES).filter((s) => s.structureType == STRUCTURE_ROAD).length > 0;
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
    return this.body.filter((part) => part.type == type)
      .length;
  }
}