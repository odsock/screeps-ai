import { RoomWrapper } from "structures/room-wrapper";
import { PlannerUtils } from "./planner-utils";
import { MemoryUtils } from "./memory-utils";

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
    const info = controller.room.memory.controller.container;
    if (info && PlannerUtils.validateStructureInfo(info) === OK) {
      return;
    }
    const findResult = PlannerUtils.findAdjacentStructure<StructureContainer>(controller.pos, STRUCTURE_CONTAINER);
    if (findResult) {
      controller.room.memory.controller.container = {
        id: findResult.id,
        pos: MemoryUtils.packRoomPosition(findResult.pos),
        type: STRUCTURE_CONTAINER
      };
      return;
    }
    const containerInfo = PlannerUtils.placeAdjacentStructure<StructureContainer>(controller.pos, STRUCTURE_CONTAINER);
    controller.room.memory.controller.container = containerInfo;
  }

  private static placeLink(controller: StructureController) {
    const info = controller.room.memory.controller.link;
    if (info && PlannerUtils.validateStructureInfo(info) === OK) {
      return;
    }
    const containerPosPacked = controller.room.memory.controller.container?.pos;
    if (!containerPosPacked) {
      return;
    }
    const containerPos = MemoryUtils.unpackRoomPosition(containerPosPacked);
    const findResult = PlannerUtils.findAdjacentStructure<StructureLink>(containerPos, STRUCTURE_LINK);
    if (findResult) {
      controller.room.memory.controller.link = {
        id: findResult.id,
        pos: MemoryUtils.packRoomPosition(findResult.pos),
        type: STRUCTURE_LINK
      };
    }
    const linkInfo = PlannerUtils.placeAdjacentStructure<StructureLink>(containerPos, STRUCTURE_LINK);
    controller.room.memory.controller.link = linkInfo;
  }
}
