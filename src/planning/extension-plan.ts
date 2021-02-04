import config from '../constants';
import { PlannerUtils } from './planner-utils';

export class ExtensionPlan {
  constructor(private readonly room: Room) { }

  public planExtensionGroup() {
    const numAvailableExtensions = this.getNumAvailableExtensions();
    // console.log(`numAvailableExtensions: ${numAvailableExtensions}`);
    if (numAvailableExtensions >= 5) {
      const structurePlan = PlannerUtils.findSiteForPattern(config.STRUCTURE_PLAN_EXTENSION_GROUP, this.room);
      if (structurePlan.plan != undefined) {
        console.log(`draw site: ${structurePlan.plan[0].x}, ${structurePlan.plan[0].y}`);
        const visual = this.room.visual.poly(structurePlan.plan);
        structurePlan.plan.forEach((pos) => {
          const structureType = structurePlan.getStructureAt(pos);
          if (structureType) {
            const result = this.room.createConstructionSite(pos, structureType);
            if (result != 0) {
              console.log(`road failed: ${result}, pos: ${pos}`);
            }
          }
        });
      }
    }
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