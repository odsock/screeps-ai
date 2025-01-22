import { StructurePatterns } from "config/structure-patterns";
import { RoomWrapper } from "structures/room-wrapper";
import { PlannerUtils } from "./planner-utils";
import { StructurePlanPosition } from "./structure-plan";

import { profile } from "../../screeps-typescript-profiler";

@profile
export class ExtensionPlan {
  private readonly roomw: RoomWrapper;

  public constructor(room: Room) {
    this.roomw = RoomWrapper.getInstance(room.name);
  }

  public planExtensionGroup(): StructurePlanPosition[] | undefined {
    const numAvailableExtensions = this.roomw.getAvailableStructureCount(STRUCTURE_EXTENSION);
    if (numAvailableExtensions >= 5) {
      const structurePlan = PlannerUtils.findSiteForPattern(
        StructurePatterns.EXTENSION_GROUP,
        this.roomw,
        this.roomw.spawns[0].pos
      );
      if (structurePlan) {
        const placementResult = PlannerUtils.placeStructurePlan({ planPositions: structurePlan, roomw: this.roomw });
        if (placementResult === OK) {
          return structurePlan;
        }
      }
    }
    return undefined;
  }
}
