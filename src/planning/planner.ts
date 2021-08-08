import { RoomWrapper } from "structures/room-wrapper";
import { ContainerPlan } from "./container-plan";
import { ExtensionPlan } from "./extension-plan";
import { RoadPlan } from "./road-plan";
import { PlannerUtils } from "./planner-utils";

export class Planner {
  private readonly room: RoomWrapper;

  public constructor(room: Room) {
    this.room = new RoomWrapper(room);
  }

  public run(): ScreepsReturnCode {
    this.refreshRoomMemory();

    if (this.room.controller) {
      if (this.room.controller?.level >= 1) {
        const spawns = this.room.find(FIND_MY_SPAWNS);
        if (spawns.length === 0) {
          const ret = this.placeFirstSpawn();
          if (ret !== OK) {
            return ret;
          }
        }
      }

      if (this.room.controller?.level >= 2) {
        console.log(`${this.room.name}: running planning`);

        // place available extensions
        const extensionPlan = new ExtensionPlan(this.room);
        const extensionResult = extensionPlan.planExtensionGroup();
        if (extensionResult !== OK) {
          return extensionResult;
        }

        // place source containers
        const containerPlan = new ContainerPlan(this.room);
        const sourceContainerResult = containerPlan.placeSourceContainer();
        if (sourceContainerResult !== OK) {
          return sourceContainerResult;
        }

        // place controller container
        const controllerContainerResult = containerPlan.placeControllerContainer();
        if (controllerContainerResult !== OK) {
          return controllerContainerResult;
        }

        // place road from source container to controller container
        const roadPlan = new RoadPlan(this.room);
        const containerRoadResult = roadPlan.placeRoadSourceContainerToControllerContainer();
        if (containerRoadResult !== OK) {
          return containerRoadResult;
        }

        // place roads to all extensions
        const extensionRoadResult = roadPlan.placeExtensionRoads();
        if (extensionRoadResult !== OK) {
          return extensionRoadResult;
        }

        // place towers
        if (PlannerUtils.getAvailableStructureCount(STRUCTURE_TOWER, this.room) > 0) {
          const towerResult = this.placeTowerAtCenterOfColony();
          if (towerResult !== OK) {
            return towerResult;
          }
        }

        // TODO: place ramparts over containers
      }
    }
    return OK;
  }

  // TODO: find a place for spawn with simple rules
  private placeFirstSpawn(): ScreepsReturnCode {
    // if (this.room.controller) {
    //   this.room.controller.pos.
    // }
    return ERR_INVALID_TARGET;
  }

  // TODO: refactor memory init to new class
  public refreshRoomMemory(): void {
    console.log(`refresh room memory`);
    PlannerUtils.refreshContainerMemory(this.room);
  }

  private placeTowerAtCenterOfColony(): ScreepsReturnCode {
    const centerPos = PlannerUtils.findColonyCenter(this.room);
    const line = PlannerUtils.getPositionSpiral(centerPos, 10);

    let ret: ScreepsReturnCode = ERR_NOT_FOUND;
    for (const pos of line) {
      ret = this.room.createConstructionSite(pos, STRUCTURE_TOWER);
      if (ret === OK) {
        break;
      }
    }
    return ret;
  }
}
