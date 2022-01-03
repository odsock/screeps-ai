import { StructurePatterns } from "config/structure-patterns";
import { RoomWrapper } from "structures/room-wrapper";
import { PlannerUtils } from "./planner-utils";
import { StructurePlanPosition } from "./structure-plan";

export class ExtensionPlan {
  private readonly roomw: RoomWrapper;

  public constructor(room: Room) {
    this.roomw = RoomWrapper.getInstance(room.name);
  }

  public planExtensionGroup(): StructurePlanPosition[] | undefined {
    const numAvailableExtensions = this.getNumAvailableExtensions();
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

  private getNumAvailableExtensions(): number {
    let availableExtensions = 0;
    const conLevel = this.roomw.controller?.level;
    if (conLevel) {
      const maxExtensions = CONTROLLER_STRUCTURES.extension[conLevel];
      const builtExtensions = this.roomw.find(FIND_MY_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_EXTENSION
      }).length;
      const placedExtensions = this.roomw.find(FIND_MY_CONSTRUCTION_SITES, {
        filter: s => s.structureType === STRUCTURE_EXTENSION
      }).length;
      availableExtensions = maxExtensions - builtExtensions - placedExtensions;
    }
    console.log(`${this.roomw.name}: extensions available: ${availableExtensions}`);
    return availableExtensions;
  }
}
