import { MemoryUtils } from "planning/memory-utils";
import { PlannerUtils } from "planning/planner-utils";
import { RoomWrapper } from "structures/room-wrapper";

export class ReconControl {
  public run(): void {
    // check each room we can see
    for (const roomName in Game.rooms) {
      const room = RoomWrapper.getInstance(roomName);
      this.refreshRoomDefense(room);
      this.refreshSourceMemory(room);
      this.refreshControllerMemory(room);
    }
  }

  private refreshRoomDefense(room: RoomWrapper) {
    const hostileCreeps = room.find(FIND_HOSTILE_CREEPS);
    const hostileStructures = room.find(FIND_HOSTILE_STRUCTURES);
    room.memory.defense = { creeps: hostileCreeps, structures: hostileStructures };
  }

  private refreshControllerMemory(room: Room): void {
    if (!room.controller) {
      return;
    }
    // initialize controller memory
    const controllerMemory = room.memory.controller;
    if (!controllerMemory) {
      room.memory.controller = {
        pos: MemoryUtils.packRoomPosition(room.controller?.pos)
      };
      return;
    }

    // validate id's
    const controllerInfo = room.memory.controller;
    if (controllerInfo.containerId && !Game.getObjectById(controllerInfo.containerId)) {
      controllerInfo.containerId = undefined;
    }
    if (controllerInfo.linkId && !Game.getObjectById(controllerInfo.linkId)) {
      controllerInfo.linkId = undefined;
    }
    if (controllerInfo.haulerId && !Game.getObjectById(controllerInfo.haulerId)) {
      controllerInfo.haulerId = undefined;
    }
  }

  private refreshSourceMemory(room: RoomWrapper): void {
    // initialize source memory
    if (!room.memory.sources) {
      room.memory.sources = this.initRoomSources(room);
      return;
    }

    // validate id's
    for (const sourceId in room.memory.sources) {
      const sourceInfo = room.memory.sources[sourceId];
      if (sourceInfo.containerId && !Game.getObjectById(sourceInfo.containerId)) {
        sourceInfo.containerId = undefined;
      }
      if (sourceInfo.linkId && !Game.getObjectById(sourceInfo.linkId)) {
        sourceInfo.linkId = undefined;
      }
      if (sourceInfo.minderId && !Game.getObjectById(sourceInfo.minderId)) {
        sourceInfo.minderId = undefined;
      }
      if (sourceInfo.haulerId && !Game.getObjectById(sourceInfo.haulerId)) {
        sourceInfo.haulerId = undefined;
      }
    }
  }

  private initRoomSources(room: RoomWrapper): RoomSources {
    const roomSources: RoomSources = {};
    room.find(FIND_SOURCES).forEach(source => {
      roomSources[source.id] = {
        id: source.id,
        pos: MemoryUtils.packRoomPosition(source.pos),
        harvestPositions: this.findHarvestPositions(source)
      };
    });
    return roomSources;
  }

  private findHarvestPositions(source: Source) {
    return PlannerUtils.getPositionSpiral(source.pos, 1)
      .filter(pos => PlannerUtils.isEnterable(pos))
      .map(pos => MemoryUtils.packRoomPosition(pos));
  }
}
