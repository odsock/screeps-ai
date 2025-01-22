import { RoomWrapper } from "structures/room-wrapper";
import { PlannerUtils } from "./planner-utils";
import { MemoryUtils } from "./memory-utils";

import { profile } from "../../screeps-typescript-profiler";

@profile
export class ControllerPlan {
  public constructor(private readonly roomw: RoomWrapper) {}

  public run(): void {
    const controller = this.roomw.controller;
    if (!controller) {
      return;
    }
    const rcl = controller.level ?? 0;
    if (rcl >= 2) {
      this.placeContainer(controller);
    }
    if (rcl >= 5) {
      this.placeLink(controller);
    }
  }

  private readonly plannerUtils = new PlannerUtils(this.roomw);

  private placeContainer(controller: StructureController) {
    const roomName = controller.room.name;
    const info = Memory.rooms[roomName].controller?.container;
    if (info && this.plannerUtils.validateStructureInfo(info) === OK) {
      return;
    }
    if (Memory.rooms[roomName].controller) {
      const findResult = this.plannerUtils.findAdjacentStructure<StructureContainer>(
        controller.pos,
        STRUCTURE_CONTAINER
      );
      if (findResult) {
        Memory.rooms[roomName].controller.container = {
          id: findResult.id,
          pos: MemoryUtils.packRoomPosition(findResult.pos),
          type: STRUCTURE_CONTAINER
        };
        return;
      }
      const containerInfo = this.plannerUtils.placeAdjacentStructure<StructureContainer>(
        controller.pos,
        STRUCTURE_CONTAINER
      );
      Memory.rooms[roomName].controller.container = containerInfo;
    }
  }

  private placeLink(controller: StructureController) {
    if (!controller.room.memory.controller) {
      return;
    }
    const info = controller.room.memory.controller?.link;
    if (info && this.plannerUtils.validateStructureInfo(info) === OK) {
      return;
    }
    const containerPosPacked = controller.room.memory.controller?.container?.pos;
    if (!containerPosPacked) {
      return;
    }
    const containerPos = MemoryUtils.unpackRoomPosition(containerPosPacked);
    const findResult = this.plannerUtils.findAdjacentStructure<StructureLink>(containerPos, STRUCTURE_LINK);
    if (findResult && controller.room.memory.controller) {
      controller.room.memory.controller.link = {
        id: findResult.id,
        pos: MemoryUtils.packRoomPosition(findResult.pos),
        type: STRUCTURE_LINK
      };
    }
    const linkInfo = this.plannerUtils.placeAdjacentStructure<StructureLink>(containerPos, STRUCTURE_LINK);
    controller.room.memory.controller.link = linkInfo;
  }
}
