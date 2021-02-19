export class CreepUtils {
  public static harvest(creep: Creep): void {
    // harvest if adjacent to tombstone or ruin
    let tombstone = CreepUtils.findClosestTombstoneWithEnergy(creep);
    if (tombstone && creep.withdraw(tombstone, RESOURCE_ENERGY) == OK) {
      return;
    }
    let ruin = CreepUtils.findClosestRuinsWithEnergy(creep);
    if (ruin && creep.withdraw(ruin, RESOURCE_ENERGY) == OK) {
      return;
    }

    let container = CreepUtils.findClosestContainerWithEnergy(creep);
    if (container && CreepUtils.withdrawEnergyFromOrMoveTo(creep, container) != ERR_NO_PATH) {
      return;
    }

    let activeSource = CreepUtils.findClosestActiveEnergySource(creep);
    if (activeSource && CreepUtils.harvestEnergyFromOrMoveTo(creep, activeSource) != ERR_NO_PATH) {
      return;
    }

    if (tombstone && CreepUtils.withdrawEnergyFromOrMoveTo(creep, tombstone) != ERR_NO_PATH) {
      return;
    }

    if (ruin && CreepUtils.withdrawEnergyFromOrMoveTo(creep, ruin) != ERR_NO_PATH) {
      return;
    }

    let inactiveSource = CreepUtils.findClosestEnergySource(creep);
    CreepUtils.consoleLogIfWatched(creep, `moving to inactive source: ${inactiveSource?.pos.x},${inactiveSource?.pos.y}`);
    if (inactiveSource) {
      creep.moveTo(inactiveSource, { visualizePathStyle: { stroke: '#ffaa00' } });
      return;
    }

    creep.say('🤔');
    CreepUtils.consoleLogIfWatched(creep, `stumped. Just going to sit here.`);
  }

  public static findClosestTombstoneWithEnergy(creep: Creep): Tombstone | null {
    return creep.pos.findClosestByPath(FIND_TOMBSTONES, { filter: (t) => t.store.getUsedCapacity(RESOURCE_ENERGY) > 0 });
  }

  public static findClosestContainerWithEnergy(creep: Creep): StructureContainer | null {
    let container = creep.pos.findClosestByPath(FIND_STRUCTURES, { filter: (s) => s.structureType == STRUCTURE_CONTAINER && s.store.getUsedCapacity() > 0 });
    return container as StructureContainer;
  }

  public static findClosestRuinsWithEnergy(creep: Creep): Ruin | null {
    return creep.pos.findClosestByPath(FIND_RUINS, { filter: (r) => r.store.getUsedCapacity(RESOURCE_ENERGY) > 0 });
  }

  public static findClosestActiveEnergySource(creep: Creep): Source | null {
    return creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
  }

  public static findClosestEnergySource(creep: Creep): Source | null {
    let source = creep.pos.findClosestByPath(FIND_SOURCES);
    if (!source) {
      source = creep.pos.findClosestByRange(FIND_SOURCES);
    }
    return source;
  }

  public static withdrawEnergyFromOrMoveTo(creep: Creep, structure: Tombstone | Ruin | StructureContainer): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(creep, `moving to ${typeof structure}: ${structure.pos.x},${structure.pos.y}`);
    let result = creep.withdraw(structure, RESOURCE_ENERGY);
    if (result == ERR_NOT_IN_RANGE) {
      return creep.moveTo(structure, { visualizePathStyle: { stroke: '#ffaa00' } });
    }
    return result;
  }

  public static harvestEnergyFromOrMoveTo(creep: Creep, source: Source): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(creep, `moving to source: ${source.pos.x},${source.pos.y}`);
    let result = creep.harvest(source);
    CreepUtils.consoleLogIfWatched(creep, `harvest result: ${result}`);
    if (result == ERR_NOT_IN_RANGE) {
      return creep.moveTo(source, { range: 1, visualizePathStyle: { stroke: '#ffaa00' } });
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

  public static getEnergyStorePercentFree(structure: StructureWithStorage): number {
    const freeCap = structure.store.getFreeCapacity(RESOURCE_ENERGY);
    const totalCap = structure.store.getCapacity(RESOURCE_ENERGY);
    if (freeCap && totalCap) {
      return freeCap / totalCap;
    }
    else {
      return 0;
    }
  }

  public static findClosestTowerWithStorage(creep: Creep): StructureTower | null {
    return creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
      filter: (structure) => {
        return structure.structureType == STRUCTURE_TOWER && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
      }
    }) as StructureTower | null;
  }

  public static findClosestEnergyStorageNotFull(creep: Creep): AnyStructure | null {
    return creep.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: (structure) => {
        return (structure.structureType == STRUCTURE_EXTENSION ||
          structure.structureType == STRUCTURE_SPAWN) &&
          structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
      }
    });
  }

  public static findConstructionSites(creep: Creep) {
    return creep.room.find(FIND_CONSTRUCTION_SITES);
  }

  public static findTowers(creep: Creep): AnyOwnedStructure[] {
    return creep.room.find(FIND_MY_STRUCTURES, { filter: (structure) => structure.structureType == STRUCTURE_TOWER });
  }

  public static findRepairSites(creep: Creep): AnyStructure[] {
    return creep.room.find(FIND_STRUCTURES, { filter: (structure) => structure.hits < structure.hitsMax });
  }

  public static updateJob(creep: Creep, job: string) {
    if (creep.memory.job != job) {
      creep.memory.job = job;
      creep.say(job);
    }
  }

  public static stopWorkingIfEmpty(creep: Creep) {
    if (creep.memory.working && creep.store[RESOURCE_ENERGY] == 0) {
      creep.memory.working = false;
      creep.say('🔄 harvest');
    }
  }

  public static startWorkingIfFull(creep: Creep, message: string) {
    if (!creep.memory.working && creep.store.getFreeCapacity() == 0) {
      creep.memory.working = true;
      creep.say(message);
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
      roomCallback: (roomName) => {
        let room = Game.rooms[roomName];
        if (!room) {
          return false;
        }
        let costs = new PathFinder.CostMatrix;
        room.find(FIND_STRUCTURES).forEach((struct) => {
          if (struct.structureType === STRUCTURE_ROAD) {
            costs.set(struct.pos.x, struct.pos.y, 1);
          }
        });
        return costs;
      }
    });
  }
}
