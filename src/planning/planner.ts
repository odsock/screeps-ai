import { RoomWrapper } from "structures/room-wrapper";
import { ContainerPlan } from "./container-plan";
import { ExtensionPlan } from "./extension-plan";
import { RoadPlan } from "./road-plan";
import { PlannerUtils } from "./planner-utils";
import { MemoryUtils } from "./memory-utils";
import { CreepUtils } from "creep-utils";

export class Planner {
  private readonly room: RoomWrapper;

  public constructor(room: Room) {
    this.room = new RoomWrapper(room);
  }

  public run(): ScreepsReturnCode {
    console.log(`${this.room.name}: running planning`);
    MemoryUtils.refreshRoomMemory(this.room);

    if (this.room.controller) {
      if (this.room.controller?.level >= 1) {
        const result1 = this.planLevel1();
        CreepUtils.consoleLogResultIfWatched(this.room, `level 1 planning result`, result1);
      }

      if (this.room.controller?.level >= 2) {
        const result2 = this.planLevel2();
        CreepUtils.consoleLogResultIfWatched(this.room, `level 2 planning result`, result2);
      }
    }
    return OK;
  }

  private planLevel1(): ScreepsReturnCode {
    if (this.room.find(FIND_MY_SPAWNS).length === 0) {
      return PlannerUtils.placeFirstSpawn(this.room);
    }
    return OK;
  }

  private planLevel2(): ScreepsReturnCode {
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

    // place controller containers
    const controllerContainerResult = containerPlan.placeControllerContainer();
    if (controllerContainerResult !== OK) {
      return controllerContainerResult;
    }

    // place road from source containers to controller containers
    const roadPlan = new RoadPlan(this.room);
    const containerRoadResult = roadPlan.placeRoadSourceContainersToControllerContainers();
    if (containerRoadResult !== OK) {
      return containerRoadResult;
    }

    // place roads to all extensions
    const extensionRoadResult = roadPlan.placeRoadSpawnToExtensions();
    if (extensionRoadResult !== OK) {
      return extensionRoadResult;
    }

    // place road from controller to spawn
    const controllerRoadResult = roadPlan.placeRoadControllerToSpawn();
    if (controllerRoadResult !== OK) {
      return controllerRoadResult;
    }

    // place towers
    if (PlannerUtils.getAvailableStructureCount(STRUCTURE_TOWER, this.room) > 0) {
      const towerResult = PlannerUtils.placeTowerAtCenterOfColony(this.room);
      if (towerResult !== OK) {
        return towerResult;
      }
    }

    // TODO: place ramparts over containers
    return OK;
  }
}
