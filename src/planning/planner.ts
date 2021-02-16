import { CreepUtils } from "creep-utils";
import { ContainerPlan } from "./container-plan";
import { ExtensionPlan } from "./extension-plan";
import { RoadPlan } from "./road-plan";

export class Planner {
  constructor(private readonly room: Room) { }

  run(): ScreepsReturnCode {
    if (this.room.controller && this.room.controller?.level >= 2) {
      console.log(`${this.room.name}: running planning`);

      // place available extensions
      let extensionPlan = new ExtensionPlan(this.room);
      let result = extensionPlan.planExtensionGroup();
      if (result != OK) {
        return result;
      }

      // place first container
      let containerPlan = new ContainerPlan(this.room);
      result = containerPlan.placeSourceContainer();
      if (result != OK) {
        return result;
      }

      // place controller container
      result = containerPlan.placeControllerContainer();
      if (result != OK) {
        return result;
      }

      // TODO: make controller road come from source with container only
      // let roadPlan = new RoadPlan(this.room);
      // roadPlan.placeControllerRoad();
    }
    return OK;
  }
}