export class CreepUtils {
  static updateJob(creep: Creep, arg1: string) {
    throw new Error("Method not implemented.");
  }
  static stopWorkingIfEmpty(creep: Creep) {
    throw new Error("Method not implemented.");
  }
  static startWorkingIfFull(creep: Creep, arg1: string) {
    throw new Error("Method not implemented.");
  }
  static touchRoad(pos: RoomPosition) {
    const roadUseLog = Game.rooms[pos.roomName].memory.roadUseLog;
    if (!roadUseLog) {
      Game.rooms[pos.roomName].memory.roadUseLog = {};
    }
    let timesUsed = Game.rooms[pos.roomName].memory.roadUseLog[`${pos.x},${pos.y}`];
    if (!timesUsed) {
      timesUsed = 0;
    }
    Game.rooms[pos.roomName].memory.roadUseLog[`${pos.x},${pos.y}`] = timesUsed + 1;
  }

  public static harvest(creep: Creep): void {
    // harvest if adjacent to tombstone or ruin
    let tombstone = creep.closestTombstoneWithEnergy;
    if (tombstone && creep.withdraw(tombstone, RESOURCE_ENERGY) == OK) {
      return;
    }
    let ruin = creep.closestRuinsWithEnergy;
    if (ruin && creep.withdraw(ruin, RESOURCE_ENERGY) == OK) {
      return;
    }

    let container = creep.closestContainerWithEnergy;
    if (container && CreepUtils.withdrawEnergyFromOrMoveTo(creep, container) != ERR_NO_PATH) {
      return;
    }

    let activeSource = creep.closestActiveEnergySource;
    if (activeSource && CreepUtils.harvestEnergyFromOrMoveTo(creep, activeSource) != ERR_NO_PATH) {
      return;
    }

    if (tombstone && CreepUtils.withdrawEnergyFromOrMoveTo(creep, tombstone) != ERR_NO_PATH) {
      return;
    }

    if (ruin && CreepUtils.withdrawEnergyFromOrMoveTo(creep, ruin) != ERR_NO_PATH) {
      return;
    }

    let inactiveSource = creep.closestEnergySource;
    CreepUtils.consoleLogIfWatched(creep, `moving to inactive source: ${inactiveSource?.pos.x},${inactiveSource?.pos.y}`);
    if (inactiveSource) {
      creep.moveTo(inactiveSource, { visualizePathStyle: { stroke: '#ffaa00' } });
      return;
    }

    creep.say('🤔');
    CreepUtils.consoleLogIfWatched(creep, `stumped. Just going to sit here.`);
  }

  public static withdrawEnergyFromOrMoveTo(creep: Creep, structure: Tombstone | Ruin | StructureContainer): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(creep, `moving to ${typeof structure}: ${structure.pos.x},${structure.pos.y}`);
    let result = creep.withdraw(structure, RESOURCE_ENERGY);
    if (result == ERR_NOT_IN_RANGE) {
      result = creep.moveTo(structure, { range: 1, visualizePathStyle: { stroke: '#ffaa00' } });
      if (result == OK) {
        result = creep.withdraw(structure, RESOURCE_ENERGY);
      }
    }
    return result;
  }

  public static pickupFromOrMoveTo(creep: Creep, resource: Resource): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(creep, `moving to ${typeof resource}: ${resource.pos.x},${resource.pos.y}`);
    let result: ScreepsReturnCode = creep.pickup(resource);
    if (result == ERR_NOT_IN_RANGE) {
      result = creep.moveTo(resource, { range: 1, visualizePathStyle: { stroke: '#ffaa00' } });
      if (result == OK) {
        result = creep.pickup(resource);
      }
    }
    return result;
  }

  public static harvestEnergyFromOrMoveTo(creep: Creep, source: Source): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(creep, `moving to ${typeof source}: ${source.pos.x},${source.pos.y}`);
    let result: ScreepsReturnCode = creep.harvest(source);
    if (result == ERR_NOT_IN_RANGE) {
      result = creep.moveTo(source, { range: 1, visualizePathStyle: { stroke: '#ffaa00' } });
      if (result == OK) {
        result = creep.harvest(source);
      }
    }
    return result;
  }

  public static consoleLogIfWatched(watchable: Watchable, message: string) {
    if (watchable.memory.watched == true) {
      console.log(`${watchable.name}: ${message}`);
    }
  }

  public static roomMemoryLog(room: Room, message: string): void {
    if (!room.memory.log) {
      room.memory.log = [];
    }
    room.memory.log.push(`${Game.time}: ${message}`);
  }

  public static getEnergyStoreRatioFree(structure: StructureWithStorage): number {
    const freeCap = structure.store.getFreeCapacity(RESOURCE_ENERGY);
    const totalCap = structure.store.getCapacity(RESOURCE_ENERGY);
    if (freeCap && totalCap) {
      return freeCap / totalCap;
    }
    else {
      return 0;
    }
  }

  public static workIfCloseToJobsite(creep: Creep, jobsite: RoomPosition, range = 3) {
    // skip check if full/empty
    if (creep.store.getUsedCapacity() != 0 && creep.store.getFreeCapacity() != 0) {
      // skip check if can work from here
      if (creep.pos.inRangeTo(jobsite, range)) {
        return;
      }
      // skip check if no source or next to source already
      const source = creep.closestActiveEnergySource;
      if (!source || creep.pos.isNearTo(source)) {
        return;
      }

      // calculate effiency of heading back to refill, then going to job site
      const sourceCost = PathFinder.search(creep.pos, { pos: source.pos, range: 1 }).cost;
      CreepUtils.consoleLogIfWatched(creep, `sourceCost: ${sourceCost}`);
      // subtract one from runCost because you cannot stand on the source
      let runCost = PathFinder.search(source.pos, { pos: jobsite, range: 3 }).cost;
      if (runCost > 1) {
        runCost = runCost - 1;
      }
      const refillEfficiency = sourceCost + runCost;
      CreepUtils.consoleLogIfWatched(creep, `runCost: ${runCost}, refillEfficiency: ${refillEfficiency}`);

      // calculate effiency of going to job site partially full
      const jobsiteCost = PathFinder.search(creep.pos, { pos: jobsite, range: 3 }).cost;
      const storeRatio = creep.store.getUsedCapacity() / creep.store.getCapacity();
      const jobsiteEfficiency = jobsiteCost / storeRatio;
      CreepUtils.consoleLogIfWatched(creep, `jobsiteCost: ${jobsiteCost}, storeRatio: ${storeRatio}, jobsiteEfficiency: ${jobsiteEfficiency}`);

      // compare cost/energy delivered working vs refilling first
      if (jobsiteEfficiency < refillEfficiency) {
        CreepUtils.consoleLogIfWatched(creep, `close to site: starting work`);
        creep.memory.working = true;
      }
      else {
        CreepUtils.consoleLogIfWatched(creep, `close to source: stopping work`);
        creep.memory.working = false;
      }
    }
  }

  public static calcWalkTime(creep: Creep, path: PathFinderPath): number {
    let roadCount = 0;
    let plainCount = 0;
    let spwampCount = 0;
    const terrain = creep.room.getTerrain();
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

    const moveParts = creep.body.filter((p) => p.type == MOVE).length;
    const heavyParts = creep.body.filter((p) => p.type != MOVE && p.type != CARRY).length;
    const moveRatio = heavyParts / (moveParts * 2);

    const plainCost = Math.ceil(2 * moveRatio) * plainCount;
    const roadCost = Math.ceil(1 * moveRatio) * roadCount;
    const spwampCost = Math.ceil(10 * moveRatio) * spwampCount;

    return roadCost + plainCost + spwampCost + 1;
  }

  public static getPath(origin: RoomPosition, goal: RoomPosition): PathFinderPath {
    return PathFinder.search(origin, { pos: goal, range: 1 }, {
      plainCost: 2,
      swampCost: 10,
      roomCallback: this.getRoadCostMatrix
    });
  }

  public static getRoadCostMatrix(roomName: string): CostMatrix | boolean {
    const room = Game.rooms[roomName];
    if (!room) return false;
    let cost = new PathFinder.CostMatrix();

    const structures = room.find(FIND_STRUCTURES);
    CreepUtils.updateRoadCostMatrixForStructures(structures, cost);

    const constructionSites = room.find(FIND_CONSTRUCTION_SITES);
    CreepUtils.updateRoadCostMatrixForStructures(constructionSites, cost);

    return cost;
  }

  private static updateRoadCostMatrixForStructures(structures: AnyStructure[] | ConstructionSite[], cost: CostMatrix) {
    for (let i = 0; i < structures.length; i++) {
      const structure = structures[i];
      if (structure.structureType == STRUCTURE_ROAD) {
        cost.set(structure.pos.x, structure.pos.y, 1);
      }
      else if (structure.structureType !== STRUCTURE_CONTAINER && (structure.structureType !== STRUCTURE_RAMPART || !structure.my)) {
        cost.set(structure.pos.x, structure.pos.y, 0xff);
      }
    }
  }
}
