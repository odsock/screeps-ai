import { RoomWrapper } from "structures/room-wrapper";

export class Logger {
  public run(): void {
    for (const roomName in Game.rooms) {
      this.logRoom(Game.rooms[roomName]);
    }
  }

  public logRoom(room: Room): void {
    const roomw = new RoomWrapper(room);

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
      const site = Game.getObjectById(roomw.memory.construction[id].id);
      if (site && site.progress <= site.progressTotal) {
        roomw.memory.construction[id].progress = site.progress / site.progressTotal;
      } else if (!site && !roomw.memory.construction[id].endTime) {
        roomw.memory.construction[id].endTime = Game.time;
        roomw.memory.construction[id].progress = 1;
      }
    }

    // TODO log RCL level times

    // log when 5 extensions reached
    const lastExtensionCount = roomw.memory.extensionCount;
    const extensionCount = roomw.find(FIND_MY_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_EXTENSION
    }).length;
    roomw.memory.extensionCount = extensionCount;
    if (extensionCount !== lastExtensionCount && extensionCount === 1) {
      roomw.roomMemoryLog("reached 1 extensions");
    } else if (extensionCount !== lastExtensionCount && extensionCount === 5) {
      roomw.roomMemoryLog("reached 5 extensions");
    }
  }
}
