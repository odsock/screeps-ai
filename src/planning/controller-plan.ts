import { RoomWrapper } from "structures/room-wrapper";
import { PlannerUtils } from "./planner-utils";

export class ControllerPlan {
  public static run(roomw: RoomWrapper): void {
    if (!roomw.controller) {
      return;
    }
    const rcl = roomw.controller?.level ?? 0;
    if (rcl >= 2) {
      ControllerPlan.placeContainer(roomw.controller);
    }
    if (rcl >= 5) {
      this.placeLink(roomw.controller);
    }
  }

  private static placeContainer(controller: StructureController) {
    const containerInfo = PlannerUtils.placeAdjacentStructure(
      controller.pos,
      STRUCTURE_CONTAINER,
      controller.room.memory.controller.container
    );
    controller.room.memory.controller.container = containerInfo;
  }

  private static placeLink(controller: StructureController) {
    const linkInfo = PlannerUtils.placeAdjacentStructure(
      controller.pos,
      STRUCTURE_LINK,
      controller.room.memory.controller.link
    );
    controller.room.memory.controller.link = linkInfo;
  }
}