import { RoomWrapper } from "structures/room-wrapper";
import { MemoryUtils } from "./memory-utils";
import { PlannerUtils } from "./planner-utils";

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

export class SourcePlan {
  public static run(roomw: RoomWrapper): void {
    const rcl = roomw.controller?.level ?? 0;
    if (rcl >= 2) {
      this.placeSourceContainers(roomw);
    }
    if (rcl >= 5) {
      this.placeSourceLinks(roomw);
    }
  }

  private static placeSourceLinks(roomw: RoomWrapper) {}

  private static placeSourceContainers(roomw: RoomWrapper): ScreepsReturnCode {
    for (const source of roomw.sources) {
      if (PlannerUtils.validateContainerInfo(roomw.memory.sources[source.id]) === OK) {
        continue;
      }

      // search for unknown existing container
      const adjacentContainerId = PlannerUtils.findAdjacentContainerId(source.pos);
      if (adjacentContainerId) {
        roomw.memory.sources[source.id].containerId = adjacentContainerId;
        continue;
      }

      // place container at this source
      const pos = PlannerUtils.placeStructureAdjacent(source.pos, STRUCTURE_CONTAINER);
      if (pos) {
        roomw.memory.sources[source.id].containerPos = MemoryUtils.packRoomPosition(pos);
        continue;
      }

      return ERR_INVALID_TARGET;
    }
    return OK;
  }
}
