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
    this.setupRoomMemory();

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
        if (this.getAvailableStructureCount(STRUCTURE_TOWER) > 0) {
          const towerResult = this.placeTower();
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
  public setupRoomMemory(): void {
    console.log(`setup room memory`);
    PlannerUtils.refreshContainerMemory(this.room);
  }

  private getContainerIdAt(containerPos: RoomPosition): string | undefined {
    const container = containerPos.lookFor(LOOK_STRUCTURES).filter(s => s.structureType === STRUCTURE_CONTAINER);
    if (container.length > 0) {
      return container[0].id;
    }
    return undefined;
  }

  private placeTower(): ScreepsReturnCode {
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

  private getAvailableStructureCount(structureConstant: BuildableStructureConstant): number {
    let available = 0;
    const rcl = this.room.controller?.level;
    if (rcl) {
      const max = CONTROLLER_STRUCTURES[structureConstant][rcl];
      const built = this.room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === structureConstant }).length;
      const placed = this.room.find(FIND_MY_CONSTRUCTION_SITES, {
        filter: s => s.structureType === structureConstant
      }).length;
      available = max - built - placed;
    }
    console.log(`${this.room.name}: ${structureConstant}s available: ${available}`);
    return available;
  }
}
