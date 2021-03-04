import { CreepUtils } from "creep-utils";

export class Logger {
  public run() {
    for (let roomName in Game.rooms) {
      this.logRoom(Game.rooms[roomName]);
    }
  }

  public logRoom(room: Room) {
    if (!room.memory.construction) {
      room.memory.construction = {};
    }

    // add all construction sites to log
    const constructionSites = room.find(FIND_MY_CONSTRUCTION_SITES);
    for (let i = 0; i < constructionSites.length; i++) {
      const site = constructionSites[i];
      if (!room.memory.construction[site.id]) {
        room.memory.construction[site.id] = { id: site.id, type: site.structureType, pos: site.pos, startTime: Game.time };
      }
    }

    // update any completed ones
    for (let id in room.memory.construction) {
      const site = Game.getObjectById(room.memory.construction[id].id);
      if (site && site.progress <= site.progressTotal) {
        room.memory.construction[id].progress = site.progress / site.progressTotal;
      }
      else if (!site && !room.memory.construction[id].endTime) {
        room.memory.construction[id].endTime = Game.time;
        room.memory.construction[id].progress = 1;
      }
    }

    // log when 5 extensions reached
    const lastExtensionCount = room.memory.extensionCount;
    const extensionCount = room.find(FIND_MY_STRUCTURES, { filter: (s) => s.structureType == STRUCTURE_EXTENSION }).length;
    room.memory.extensionCount = extensionCount;
    if (extensionCount != lastExtensionCount && extensionCount == 1) {
      CreepUtils.roomMemoryLog(room, 'reached 1 extensions');
    }
    else if (extensionCount != lastExtensionCount && extensionCount == 5) {
      CreepUtils.roomMemoryLog(room, 'reached 5 extensions');
    }
  }
}