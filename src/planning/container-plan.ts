import { CreepUtils } from "creep-utils";
import { RoomWrapper } from "structures/room-wrapper";
import { MemoryUtils } from "./memory-utils";
import { PlannerUtils } from "./planner-utils";

export class ContainerPlan {
  private readonly roomw: RoomWrapper;

  public constructor(room: Room) {
    this.roomw = RoomWrapper.getInstance(room.name);
  }

  public placeControllerContainer(): ScreepsReturnCode {
    if (this.roomw.controller) {
      CreepUtils.consoleLogIfWatched(this.roomw, `place controller container`);
      // check memory for known container
      if (this.validateContainerInfo(this.roomw.memory.controller) === OK) {
        return OK;
      }

      // search for unknown existing container
      const adjacentContainerId = this.findAdjacentContainerId(this.roomw.controller.pos);
      if (adjacentContainerId) {
        CreepUtils.consoleLogIfWatched(this.roomw, `controller container found: ${adjacentContainerId}`);
        this.roomw.memory.controller.containerId = adjacentContainerId;
        return OK;
      }

      // place the container
      CreepUtils.consoleLogIfWatched(this.roomw, `controller has no container in memory`);
      const containerPos = PlannerUtils.placeStructureAdjacent(this.roomw.controller.pos, STRUCTURE_CONTAINER);
      if (containerPos) {
        CreepUtils.consoleLogIfWatched(this.roomw, `placing controller container`);
        this.roomw.memory.controller.containerPos = MemoryUtils.packRoomPosition(containerPos);
        return OK;
      }
      CreepUtils.consoleLogIfWatched(this.roomw, `ERROR: failed to place controller container`);
      return ERR_INVALID_TARGET;
    }
    return OK;
  }

  private findAdjacentContainerId(pos: RoomPosition): Id<StructureContainer> | undefined {
    const lookResult = this.roomw
      .lookForAtArea(LOOK_STRUCTURES, pos.y - 1, pos.x - 1, pos.y + 1, pos.x + 1, true)
      .find(structure => structure.structure.structureType === STRUCTURE_CONTAINER);
    if (lookResult?.structure) {
      return lookResult.structure.id as Id<StructureContainer>;
    }
    return undefined;
  }

  private validateContainerInfo(info: ControllerInfo | SourceInfo): ScreepsReturnCode {
    // check for valid container id
    if (info.containerId && Game.getObjectById(info.containerId)) {
      CreepUtils.consoleLogIfWatched(this.roomw, `container already exists`);
      return OK;
    } else {
      info.containerId = undefined;
    }

    // check for valid construction site id
    if (info.containerConstructionSiteId && Game.getObjectById(info.containerConstructionSiteId)) {
      CreepUtils.consoleLogIfWatched(this.roomw, `container in construction: ${info.containerConstructionSiteId}`);
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
        CreepUtils.consoleLogIfWatched(this.roomw, `container found at ${String(containerMemPos)}`);
        return OK;
      }
      // check for construction site at pos
      const containerConstructionSite = containerMemPos
        .lookFor(LOOK_CONSTRUCTION_SITES)
        .find(structure => structure.structureType === STRUCTURE_CONTAINER);
      if (containerConstructionSite) {
        info.containerConstructionSiteId = containerConstructionSite.id;
        CreepUtils.consoleLogIfWatched(this.roomw, `container in construction at ${String(containerMemPos)}`);
        return OK;
      }
    }
    return ERR_NOT_FOUND;
  }

  public placeSourceContainer(): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this.roomw, `place source containers`);
    for (const source of this.roomw.sources) {
      CreepUtils.consoleLogIfWatched(this.roomw, `place source container for ${String(source)}`);
      // check memory for known container
      if (this.validateContainerInfo(this.roomw.memory.sources[source.id]) === OK) {
        continue;
      }

      // search for unknown existing container
      const adjacentContainerId = this.findAdjacentContainerId(source.pos);
      if (adjacentContainerId) {
        CreepUtils.consoleLogIfWatched(this.roomw, `source container found: ${adjacentContainerId}`);
        this.roomw.memory.sources[source.id].containerId = adjacentContainerId;
        continue;
      }

      // place container at this source
      CreepUtils.consoleLogIfWatched(this.roomw, `source without container: ${String(source)}`);
      const pos = PlannerUtils.placeStructureAdjacent(source.pos, STRUCTURE_CONTAINER);
      if (pos) {
        CreepUtils.consoleLogIfWatched(this.roomw, `placed source container at: ${String(pos)}`);
        this.roomw.memory.sources[source.id].containerPos = MemoryUtils.packRoomPosition(pos);
        continue;
      }
      CreepUtils.consoleLogIfWatched(this.roomw, `ERROR: failed to place source container at ${String(source)}`);
      return ERR_INVALID_TARGET;
    }
    return OK;
  }
}
