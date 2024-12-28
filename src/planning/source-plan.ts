import { RoomWrapper } from "structures/room-wrapper";
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
      SourcePlan.placeContainers(roomw);
    }
    if (rcl >= 5) {
      this.placeLinks(roomw);
    }
  }

  private static placeContainers(roomw: RoomWrapper) {
    for (const source of roomw.sources) {
      const containerInfo = PlannerUtils.placeAdjacentStructure<StructureContainer>(
        source.pos,
        STRUCTURE_CONTAINER,
        roomw.memory.sources[source.id].container
      );
      roomw.memory.sources[source.id].container = containerInfo;
    }
  }

  private static placeLinks(roomw: RoomWrapper) {
    for (const source of roomw.sources) {
      const linkInfo = PlannerUtils.placeAdjacentStructure<StructureLink>(
        source.pos,
        STRUCTURE_LINK,
        roomw.memory.sources[source.id].link
      );
      roomw.memory.sources[source.id].link = linkInfo;
    }
  }
}