import { CreepUtils } from 'creep-utils';
import config from '../constants';
import { PlannerUtils } from './planner-utils';
import { StructurePlan } from './structure-plan';

export class ExtensionPlan {
  constructor(private readonly room: Room) { }

  public planExtensionGroup(): ScreepsReturnCode {
    const numAvailableExtensions = this.getNumAvailableExtensions();
    if (numAvailableExtensions >= 5) {
      const structurePlan = PlannerUtils.findSiteForPattern(config.STRUCTURE_PLAN_EXTENSION_GROUP, this.room);
      return this.placeStructurePlan(structurePlan);
    }
    return OK;
  }

  private placeStructurePlan(structurePlan: StructurePlan): ScreepsReturnCode {
    if (structurePlan.plan != undefined) {
      for (let i = 0; i < structurePlan.plan?.length; i++) {
        const pos = structurePlan.plan[i];
        const structureType = structurePlan.getStructureAt(pos);
        if (structureType) {
          const result = this.room.createConstructionSite(pos, structureType);
          if (result != OK) {
            CreepUtils.roomMemoryLog(this.room, `road failed: ${result}, pos: ${pos}`);
            return result;
          }
        }
      }
    }
    return ERR_NOT_FOUND;
  }

  private getNumAvailableExtensions(): number {
    const conLevel = this.room.controller?.level;
    if (conLevel) {
      const maxExtens = CONTROLLER_STRUCTURES.extension[conLevel];
      const builtExtens = this.room.find(FIND_MY_STRUCTURES, { filter: (s) => s.structureType === STRUCTURE_EXTENSION }).length;
      const placedExtensions = this.room.find(FIND_MY_CONSTRUCTION_SITES, { filter: (s) => s.structureType === STRUCTURE_EXTENSION }).length;
      return maxExtens - builtExtens - placedExtensions;
    }
    return 0;
  }

}