import { RoomWrapper } from "structures/room-wrapper";
import { PlannerUtils } from "./planner-utils";
import { MemoryUtils } from "./memory-utils";

/*
StructureLink
Controller level
1-4	—
5	2 links
6	3 links
7	4 links
8	6 links

StructureContainer
5 at all levels
*/

import { profile } from "../../screeps-typescript-profiler";

@profile
export class SourcePlan {
  public static run(roomw: RoomWrapper): void {
    const rcl = roomw.controller?.level ?? 0;
    if (rcl >= 2) {
      SourcePlan.placeContainers(roomw);
    }
    if (rcl >= 5) {
      this.placeLinks(roomw);
    }
  }

  private static placeContainers(roomw: RoomWrapper) {
    for (const source of roomw.sources) {
      const info = roomw.memory.sources[source.id].container;
      if (info && PlannerUtils.validateStructureInfo(info) === OK) {
        continue;
      }
      const findResult = PlannerUtils.findAdjacentStructure<StructureContainer>(source.pos, STRUCTURE_CONTAINER);
      if (findResult) {
        roomw.memory.sources[source.id].container = {
          id: findResult.id,
          pos: MemoryUtils.packRoomPosition(findResult.pos),
          type: STRUCTURE_CONTAINER
        };
        continue;
      }
      const containerInfo = PlannerUtils.placeAdjacentStructure<StructureContainer>(source.pos, STRUCTURE_CONTAINER);
      roomw.memory.sources[source.id].container = containerInfo;
    }
  }

  private static placeLinks(roomw: RoomWrapper) {
    for (const source of roomw.sources) {
      const info = roomw.memory.sources[source.id].link;
      if (info && PlannerUtils.validateStructureInfo(info) === OK) {
        continue;
      }
      const containerPosPacked = roomw.memory.sources[source.id].container?.pos;
      if (!containerPosPacked) {
        continue;
      }
      const containerPos = MemoryUtils.unpackRoomPosition(containerPosPacked);
      const findResult = PlannerUtils.findAdjacentStructure<StructureLink>(containerPos, STRUCTURE_LINK);
      if (findResult) {
        roomw.memory.sources[source.id].link = {
          id: findResult.id,
          pos: MemoryUtils.packRoomPosition(findResult.pos),
          type: STRUCTURE_LINK
        };
        continue;
      }
      const linkInfo = PlannerUtils.placeAdjacentStructure<StructureLink>(containerPos, STRUCTURE_LINK);
      roomw.memory.sources[source.id].link = linkInfo;
    }
  }
}
