import { CreepUtils } from '../creep-utils';

Object.defineProperty(Creep, 'closestTombstoneWithEnergy', {
  get() {
    return this.pos.findClosestByPath(FIND_TOMBSTONES, { filter: (t: Tombstone) => t.store.getUsedCapacity(RESOURCE_ENERGY) > 0 }) as Tombstone | null;
  },
  configurable: true,
});

Object.defineProperty(Creep, 'closestContainerWithEnergy', {
  get() {
    return this.pos.findClosestByPath(FIND_STRUCTURES, { filter: (s: AnyStructure) => s.structureType == STRUCTURE_CONTAINER && s.store.getUsedCapacity() > 0 }) as StructureContainer | null;
  },
  configurable: true,
});

Object.defineProperty(Creep, 'closestRuinsWithEnergy', {
  get() {
    return this.pos.findClosestByPath(FIND_RUINS, { filter: (r: Ruin) => r.store.getUsedCapacity(RESOURCE_ENERGY) > 0 }) as Ruin | null;
  },
  configurable: true,
});

Object.defineProperty(Creep, 'closestDroppedEnergy', {
  get() {
    return this.pos.findClosestByPath(FIND_DROPPED_RESOURCES, { filter: (r: Resource) => r.resourceType == RESOURCE_ENERGY }) as Resource<RESOURCE_ENERGY> | null;
  },
  configurable: true,
});

Object.defineProperty(Creep, 'closestActiveEnergySource', {
  get() {
    return this.pos.findClosestByPath(FIND_SOURCES_ACTIVE) as Source | null;
  },
  configurable: true,
});


Object.defineProperty(Creep, 'closestEnergySource', {
  get() {
    let source = this.pos.findClosestByPath(FIND_SOURCES);
    if (source) {
      return source as Source | null;
    }
    source = this.pos.findClosestByRange(FIND_SOURCES);
    return source as Source | null;
  },
  configurable: true,
});


Object.defineProperty(Creep, 'closestTowerNotFull', {
  get() {
    return this.pos.findClosestByPath(FIND_MY_STRUCTURES, {
      filter: (structure: AnyStoreStructure) => {
        return structure.structureType == STRUCTURE_TOWER && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
      }
    }) as StructureTower | null;
  }
});

Object.defineProperty(Creep, 'closestSpawnStorageNotFull', {
  get() {
    return this.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: (structure: AnyStoreStructure) => {
        return (structure.structureType == STRUCTURE_EXTENSION ||
          structure.structureType == STRUCTURE_SPAWN) &&
          structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
      }
    }) as StructureSpawn | StructureExtension | null;
  }
});


Object.defineProperty(Creep, 'updateJob', function (this: Creep, job: string) {
  if (this.memory.job != job) {
    this.memory.job = job;
    this.say(job);
  }
});

Object.defineProperty(Creep, 'stopWorkingIfEmpty', function (this: Creep) {
  if (this.memory.working && this.store[RESOURCE_ENERGY] == 0) {
    CreepUtils.consoleLogIfWatched(this, 'stop working, empty');
    this.memory.working = false;
    this.say('🔄 harvest');
  }
});

Object.defineProperty(Creep, 'startWorkingIfFull', function (this: Creep, message: string) {
  if (!this.memory.working && this.store.getFreeCapacity() == 0) {
    CreepUtils.consoleLogIfWatched(this, 'start working, full');
    this.memory.working = true;
    this.say(message);
  }
});