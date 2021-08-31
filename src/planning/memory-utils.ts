export class MemoryUtils {
  public static unpackRoomPosition(positionString: string): RoomPosition {
    const positionArray: string[] = positionString.split(":");
    return new RoomPosition(Number(positionArray[0]), Number(positionArray[1]), positionArray[2]);
  }

  public static packRoomPosition(pos: RoomPosition): string {
    return `${pos.x}:${pos.y}:${pos.roomName}`;
  }

  public static refreshRoomMemory(room: Room): void {
    this.refreshContainerMemory(room);
  }

  public static readCacheFromMemory(): void {
    if (!global.cache && Memory.cache) {
      global.cache = JSON.parse(Memory.cache) as Map<string, CacheValue>;
    }
  }

  public static writeCacheToMemory(): void {
    if (!global.cache) {
      MemoryUtils.initCache();
    }
    global.cache.forEach((value, key) => {
      if (value.expires < Game.time) {
        global.cache.delete(key);
      }
    });
    Memory.cache = JSON.stringify(global.cache);
  }

  private static initCache() {
    global.cache = new Map<string, CacheValue>();
  }

  public static setCache<T>(key: string, item: T, ttl = 1): void {
    if (!global.cache) {
      MemoryUtils.initCache();
    }
    console.log(`set cache: ${key} => ${String(item).slice(0, 100)}, ttl ${ttl}`);
    global.cache.set(key, { item, expires: Game.time + ttl } as CacheValue);
  }

  public static getCache<T>(key: string): T | undefined {
    if (!global.cache) {
      MemoryUtils.initCache();
    }

    const value = global.cache.get(key);
    console.log(`get cache: ${key} => ${String(value)}, ${String(value?.item).slice(0, 100)}`);
    if (value) {
      return value.item as T;
    }
    return undefined;
  }

  public static refreshContainerMemory(room: Room): void {
    // init container memory
    if (!room.memory.containers) {
      console.log(`- add container memory`);
      room.memory.containers = [];
    }

    // add missing containers
    room
      .find(FIND_STRUCTURES, {
        filter: c => c.structureType === STRUCTURE_CONTAINER
      })
      .forEach(container => {
        if (!room.memory.containers.find(containerInfo => containerInfo.containerId === container.id)) {
          room.memory.containers.push({
            containerId: container.id,
            nearController: false,
            nearSource: false,
            haulers: []
          });
        }
      });

    // validate containers and claims
    const currentContainerMemory = room.memory.containers;
    room.memory.containers = currentContainerMemory
      // drop containers that don't exist
      .filter(containerInfo => !!Game.getObjectById(containerInfo.containerId as Id<StructureContainer>))
      // remove id's for creeps that don't exist
      .map(containerInfo => {
        if (containerInfo.minderId) {
          const creep = Game.getObjectById(containerInfo.minderId as Id<Creep>);
          if (!creep || creep.memory.role !== "minder") {
            containerInfo.minderId = undefined;
          }
        }
        const currentHaulers = containerInfo.haulers ? containerInfo.haulers : [];
        containerInfo.haulers = currentHaulers.filter(haulerId => !!Game.getObjectById(haulerId as Id<Creep>));
        return containerInfo;
      })
      // mark containers next to sources
      .map(containerInfo => {
        containerInfo.nearSource = false;
        const container = Game.getObjectById(containerInfo.containerId as Id<StructureContainer>);
        if (container) {
          const sources = container.pos.findInRange(FIND_SOURCES, 1);
          if (sources.length > 0) {
            containerInfo.nearSource = true;
          }
        }
        return containerInfo;
      })
      // mark containers next to controllers
      .map(containerInfo => {
        containerInfo.nearController = false;
        if (room.controller && !containerInfo.nearSource) {
          const containers = room.controller.pos.findInRange(FIND_STRUCTURES, 1, {
            filter: c => c.structureType === STRUCTURE_CONTAINER && c.id === containerInfo.containerId
          });
          if (containers.length > 0) {
            containerInfo.nearController = true;
          }
        }
        return containerInfo;
      });
  }
}
