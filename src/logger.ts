import { RoomWrapper } from "structures/room-wrapper";

export class Logger {
  public run(): void {
    _.filter(Game.rooms, room => room.controller?.my).forEach(room => {
      this.logRoom(room);
    });
  }

  public logRoom(room: Room): void {
    const roomw = RoomWrapper.getInstance(room.name);

    if (!roomw.memory.construction) {
      roomw.memory.construction = {};
    }

    // add all construction sites to log
    const constructionSites = roomw.find(FIND_MY_CONSTRUCTION_SITES);
    for (const site of constructionSites) {
      if (!roomw.memory.construction[site.id]) {
        roomw.memory.construction[site.id] = {
          id: site.id,
          type: site.structureType,
          pos: site.pos,
          startTime: Game.time
        };
      }
    }

    // update any completed ones
    for (const id in roomw.memory.construction) {
      const siteStatus = roomw.memory.construction[id];
      if (siteStatus && siteStatus.progress && siteStatus.progress < 1) {
        const site = Game.getObjectById(roomw.memory.construction[id].id);
        if (site && site.progress <= site.progressTotal) {
          roomw.memory.construction[id].progress = site.progress / site.progressTotal;
        } else if (!site && !roomw.memory.construction[id].endTime) {
          roomw.memory.construction[id].endTime = Game.time;
          roomw.memory.construction[id].progress = 1;
        }
      }
    }

    if (!roomw.memory.logCounts) {
      roomw.memory.logCounts = {};
    }

    // log RCL level times
    if (roomw.controller) {
      const lastRCL = roomw.memory.logCounts.rcl;
      const currentRCL = roomw.controller?.level;
      if (lastRCL === undefined || lastRCL !== currentRCL) {
        roomw.memory.logCounts.rcl = currentRCL;
        roomw.roomMemoryLog(`new RCL ${currentRCL}`);
      }
    }

    // log extensions count changes
    const lastExtensionCount = roomw.memory.logCounts.extensionCount;
    const currentExtensionCount = roomw.find(FIND_MY_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_EXTENSION
    }).length;
    roomw.memory.logCounts.extensionCount = currentExtensionCount;
    if (lastExtensionCount && lastExtensionCount !== currentExtensionCount) {
      roomw.roomMemoryLog(`new extension count ${currentExtensionCount}`);
    }

    // log spawn creation
    const lastSpawnCount = roomw.memory.logCounts.spawnCount;
    const currentSpawnCount = roomw.spawns.length;
    if (lastSpawnCount === undefined || lastSpawnCount !== currentSpawnCount) {
      roomw.memory.logCounts.spawnCount = currentSpawnCount;
      roomw.roomMemoryLog(`new spawn count ${currentSpawnCount}`);
    }
  }
}
