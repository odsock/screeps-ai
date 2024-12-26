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
      const containerInfo = roomw.memory.sources[source.id].container;
      if (containerInfo && PlannerUtils.validateStructureInfo(containerInfo) === OK) {
        continue;
      }

      // search for unknown existing container
      const container = PlannerUtils.findAdjacentContainer(source.pos);
      if (container) {
        const pos = MemoryUtils.packRoomPosition(container.pos);
        roomw.memory.sources[source.id].container = { type: STRUCTURE_CONTAINER, id: container.id, pos };
        continue;
      }

      // place container at this source
      const pos = PlannerUtils.placeStructureAdjacent(source.pos, STRUCTURE_CONTAINER);
      if (pos) {
        roomw.memory.sources[source.id].container = {
          type: STRUCTURE_CONTAINER,
          pos: MemoryUtils.packRoomPosition(pos)
        };
        continue;
      }

      return ERR_INVALID_TARGET;
    }
    return OK;
  }
}
