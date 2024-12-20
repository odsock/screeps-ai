import { RoomWrapper } from "structures/room-wrapper";
import { MemoryUtils } from "./memory-utils";
import { PlannerUtils } from "./planner-utils";

export class ControllerPlan {
  public static run(roomw: RoomWrapper): void {
    const rcl = roomw.controller?.level ?? 0;
    if (rcl >= 2) {
      this.placeControllerContainer(roomw);
    }
    // if (rcl >= 5) {
    //   this.placeSourceLinks(roomw);
    // }
  }
  public static placeControllerContainer(roomw: RoomWrapper): ScreepsReturnCode {
    if (roomw.controller) {
      // CreepUtils.consoleLogIfWatched(roomw, `place controller container`);
      // check memory for known container
      if (PlannerUtils.validateContainerInfo(roomw.memory.controller) === OK) {
        return OK;
      }

      // search for unknown existing container
      const adjacentContainerId = PlannerUtils.findAdjacentContainerId(roomw.controller.pos);
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
}
