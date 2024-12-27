import { RoomWrapper } from "structures/room-wrapper";
import { PlannerUtils } from "./planner-utils";

export class ControllerPlan {
  public static run(roomw: RoomWrapper): void {
    if (!roomw.controller) {
      return;
    }
    const rcl = roomw.controller?.level ?? 0;
    if (rcl >= 2) {
      const containerInfo = PlannerUtils.placeAdjacentStructure(
        roomw.controller.pos,
        STRUCTURE_CONTAINER,
        roomw.memory.controller.container
      );
      roomw.memory.controller.container = containerInfo;
    }
    // if (rcl >= 5) {
    //   this.placeSourceLinks(roomw);
    // }
  }
}
