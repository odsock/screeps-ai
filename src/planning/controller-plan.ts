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
      // check memory for known container
      if (
        roomw.memory.controller.container &&
        PlannerUtils.validateStructureInfo(roomw.memory.controller.container) === OK
      ) {
        return OK;
      }

      // search for unknown existing container
      const container = PlannerUtils.findAdjacentContainer(roomw.controller.pos);
      if (container) {
        const pos = MemoryUtils.packRoomPosition(container.pos);
        roomw.memory.controller.container = { type: STRUCTURE_CONTAINER, id: container.id, pos };
        return OK;
      }

      // place the container
      const containerPos = PlannerUtils.placeStructureAdjacent(roomw.controller.pos, STRUCTURE_CONTAINER);
      if (containerPos) {
        roomw.memory.controller.container = {
          type: STRUCTURE_CONTAINER,
          pos: MemoryUtils.packRoomPosition(containerPos)
        };
        return OK;
      }
      return ERR_INVALID_TARGET;
    }
    return OK;
  }
}
