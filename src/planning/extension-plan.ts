import { RoomWrapper } from "structures/room-wrapper";
import config from "../constants";
import { PlannerUtils } from "./planner-utils";
import { StructurePlan } from "./structure-plan";

export class ExtensionPlan {
  private readonly room: RoomWrapper;

  public constructor(room: Room) {
    this.room = new RoomWrapper(room);
  }

  public planExtensionGroup(): ScreepsReturnCode {
    const numAvailableExtensions = this.getNumAvailableExtensions();
    if (numAvailableExtensions >= 5) {
      const structurePlan = PlannerUtils.findSiteForPattern(config.STRUCTURE_PLAN_EXTENSION_GROUP, this.room);
      return this.placeStructurePlan(structurePlan);
    }
    return OK;
  }

  private placeStructurePlan(structurePlan: StructurePlan): ScreepsReturnCode {
    if (structurePlan.plan) {
      for (const planPosition of structurePlan.plan) {
        const result = this.room.createConstructionSite(planPosition.pos, planPosition.structure);
        if (result !== OK) {
          this.room.roomMemoryLog(`${planPosition.structure} failed: ${result}, pos: ${String(planPosition)}`);
          return result;
        }
      }
    }
    console.log(`${this.room.name}: no site found for extension plan`);
    return ERR_NOT_FOUND;
  }

  private getNumAvailableExtensions(): number {
    let availableExtensions = 0;
    const conLevel = this.room.controller?.level;
    if (conLevel) {
      const maxExtens = CONTROLLER_STRUCTURES.extension[conLevel];
      const builtExtens = this.room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_EXTENSION })
        .length;
      const placedExtensions = this.room.find(FIND_MY_CONSTRUCTION_SITES, {
        filter: s => s.structureType === STRUCTURE_EXTENSION
      }).length;
      availableExtensions = maxExtens - builtExtens - placedExtensions;
    }
    console.log(`${this.room.name}: extensions available: ${availableExtensions}`);
    return availableExtensions;
  }
}
