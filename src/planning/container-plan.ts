import { CreepUtils } from "creep-utils";
import { RoomWrapper } from "structures/room-wrapper";
import { PlannerUtils } from "./planner-utils";

export class ContainerPlan {
  private readonly roomw: RoomWrapper;

  public constructor(room: Room) {
    this.roomw = new RoomWrapper(room);
  }

  public placeControllerContainer(): ScreepsReturnCode {
    if (this.roomw.controller) {
      const controllerContainerId = this.roomw.memory.controller.containerId;
      if (controllerContainerId && Game.getObjectById(controllerContainerId)) {
        CreepUtils.consoleLogIfWatched(this.roomw, `controller container already existsÏ`);
        return OK;
      }
      CreepUtils.consoleLogIfWatched(this.roomw, `controller has no container in memory`);
      const id = PlannerUtils.placeStructureAdjacent(this.roomw.controller.pos, STRUCTURE_CONTAINER);
      if (id) {
        CreepUtils.consoleLogIfWatched(this.roomw, `placing controller container`);
        this.roomw.memory.controller.containerId = id as Id<StructureContainer>;
        return OK;
      }
      CreepUtils.consoleLogIfWatched(this.roomw, `ERROR: failed to place controller container`);
      return ERR_INVALID_TARGET;
    }
    return OK;
  }

  public placeSourceContainer(): ScreepsReturnCode {
    for (const source of this.roomw.sources) {
      // check for existing container at this source
      const containerIdMemory = this.roomw.memory.sources[source.id].containerId;
      if (containerIdMemory && Game.getObjectById(containerIdMemory)) {
        CreepUtils.consoleLogIfWatched(this.roomw, `source already has container: ${String(source)}`);
        continue;
      }
      // place container at this source
      CreepUtils.consoleLogIfWatched(this.roomw, `source without container: ${String(source)}`);
      const id = PlannerUtils.placeStructureAdjacent(source.pos, STRUCTURE_CONTAINER);
      if (id) {
        CreepUtils.consoleLogIfWatched(this.roomw, `placed source container: ${String(id)}`);
        this.roomw.memory.sources[source.id].containerId = id as Id<StructureContainer>;
        continue;
      }
      CreepUtils.consoleLogIfWatched(this.roomw, `ERROR: failed to place source container at ${String(source)}`);
      return ERR_INVALID_TARGET;
    }
    return OK;
  }
}
