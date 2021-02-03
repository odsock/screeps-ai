import config from '../constants';
import { PlannerUtils } from './planner-utils';

export class ExtensionPlan {
    constructor(private readonly room: Room) {}

    public planExtensionGroup() {
        if (this.getNumAvailableExtensions() >= 5) {
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
          return maxExtens - builtExtens;
        }
        return 0;
      }

}