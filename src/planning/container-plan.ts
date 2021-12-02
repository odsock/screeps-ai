import { RoomWrapper } from "structures/room-wrapper";
import { MemoryUtils } from "./memory-utils";
import { PlannerUtils } from "./planner-utils";

export class ContainerPlan {
  public static placeControllerContainer(roomw: RoomWrapper): ScreepsReturnCode {
    if (roomw.controller) {
      // CreepUtils.consoleLogIfWatched(roomw, `place controller container`);
      // check memory for known container
      if (this.validateContainerInfo(roomw.memory.controller) === OK) {
        return OK;
      }

      // search for unknown existing container
      const adjacentContainerId = this.findAdjacentContainerId(roomw.controller.pos);
      if (adjacentContainerId) {
        // CreepUtils.consoleLogIfWatched(roomw, `controller container found: ${adjacentContainerId}`);
        roomw.memory.controller.containerId = adjacentContainerId;
        return OK;
      }

      // place the container
      // CreepUtils.consoleLogIfWatched(roomw, `controller has no container in memory`);
      const containerPos = PlannerUtils.placeStructureAdjacent(roomw.controller.pos, STRUCTURE_CONTAINER);
      if (containerPos) {
        // CreepUtils.consoleLogIfWatched(roomw, `placing controller container`);
        roomw.memory.controller.containerPos = MemoryUtils.packRoomPosition(containerPos);
        return OK;
      }
      // CreepUtils.consoleLogIfWatched(roomw, `ERROR: failed to place controller container`);
      return ERR_INVALID_TARGET;
    }
    return OK;
  }

  private static findAdjacentContainerId(pos: RoomPosition): Id<StructureContainer> | undefined {
    const room = Game.rooms[pos.roomName];
    if (room) {
      const lookResult = room
        .lookForAtArea(LOOK_STRUCTURES, pos.y - 1, pos.x - 1, pos.y + 1, pos.x + 1, true)
        .find(structure => structure.structure.structureType === STRUCTURE_CONTAINER);
      if (lookResult?.structure) {
        return lookResult.structure.id as Id<StructureContainer>;
      }
    }
    return undefined;
  }

  private static validateContainerInfo(info: ControllerInfo | SourceInfo): ScreepsReturnCode {
    // check for valid container id
    if (info.containerId && Game.getObjectById(info.containerId)) {
      // CreepUtils.consoleLogIfWatched(roomw, `container already exists`);
      return OK;
    } else {
      info.containerId = undefined;
    }

    // check for valid construction site id
    if (info.containerConstructionSiteId && Game.getObjectById(info.containerConstructionSiteId)) {
      // CreepUtils.consoleLogIfWatched(roomw, `container in construction: ${info.containerConstructionSiteId}`);
      return OK;
    } else {
      info.containerConstructionSiteId = undefined;
    }

    // check for container at pos
    if (info.containerPos) {
      const containerMemPos = MemoryUtils.unpackRoomPosition(info.containerPos);
      const lookResult = containerMemPos
        .lookFor(LOOK_STRUCTURES)
        .find(structure => structure.structureType === STRUCTURE_CONTAINER);
      if (lookResult) {
        info.containerId = lookResult.id as Id<StructureContainer>;
        // CreepUtils.consoleLogIfWatched(roomw, `container found at ${String(containerMemPos)}`);
        return OK;
      }
      // check for construction site at pos
      const containerConstructionSite = containerMemPos
        .lookFor(LOOK_CONSTRUCTION_SITES)
        .find(structure => structure.structureType === STRUCTURE_CONTAINER);
      if (containerConstructionSite) {
        info.containerConstructionSiteId = containerConstructionSite.id;
        // CreepUtils.consoleLogIfWatched(roomw, `container in construction at ${String(containerMemPos)}`);
        return OK;
      }
    }
    return ERR_NOT_FOUND;
  }

  public static placeSourceContainers(roomw: RoomWrapper): ScreepsReturnCode {
    // CreepUtils.consoleLogIfWatched(roomw, `place source containers`);
    for (const source of roomw.sources) {
      // CreepUtils.consoleLogIfWatched(roomw, `place source container for ${String(source)}`);
      // check memory for known container
      if (this.validateContainerInfo(roomw.memory.sources[source.id]) === OK) {
        continue;
      }

      // search for unknown existing container
      const adjacentContainerId = this.findAdjacentContainerId(source.pos);
      if (adjacentContainerId) {
        // CreepUtils.consoleLogIfWatched(roomw, `source container found: ${adjacentContainerId}`);
        roomw.memory.sources[source.id].containerId = adjacentContainerId;
        continue;
      }

      // place container at this source
      // CreepUtils.consoleLogIfWatched(roomw, `source without container: ${String(source)}`);
      const pos = PlannerUtils.placeStructureAdjacent(source.pos, STRUCTURE_CONTAINER);
      if (pos) {
        // CreepUtils.consoleLogIfWatched(roomw, `placed source container at: ${String(pos)}`);
        roomw.memory.sources[source.id].containerPos = MemoryUtils.packRoomPosition(pos);
        continue;
      }
      // CreepUtils.consoleLogIfWatched(roomw, `ERROR: failed to place source container at ${String(source)}`);
      return ERR_INVALID_TARGET;
    }
    return OK;
  }
}
