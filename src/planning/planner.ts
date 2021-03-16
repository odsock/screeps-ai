import { CreepUtils } from "creep-utils";
import { RoomWrapper } from "structures/room-wrapper";
import { ContainerPlan } from "./container-plan";
import { ExtensionPlan } from "./extension-plan";
import { RoadPlan } from "./road-plan";

export class Planner {
  private readonly roomw: RoomWrapper;

  constructor(room: Room) {
    this.roomw = new RoomWrapper(room.name);
   }

  run(): ScreepsReturnCode {
    this.setupRoomMemory();

    if (this.roomw.controller && this.roomw.controller?.level >= 2) {
      console.log(`${this.roomw.name}: running planning`);

      // place available extensions
      let extensionPlan = new ExtensionPlan(this.roomw);
      let result = extensionPlan.planExtensionGroup();
      if (result != OK) {
        return result;
      }

      // place source containers
      let containerPlan = new ContainerPlan(this.roomw);
      result = containerPlan.placeSourceContainer();
      if (result != OK) {
        return result;
      }

      // place controller container
      result = containerPlan.placeControllerContainer();
      if (result != OK) {
        return result;
      }

      // place road from source container to controller container
      let roadPlan = new RoadPlan(this.roomw);
      roadPlan.placeRoadSourceContainerToController();
      if (result != OK) {
        return result;
      }

      // TODO: place ramparts over containers
    }
    return OK;
  }

  public setupRoomMemory() {
    if (!this.roomw.memory.controllerInfo) {
      this.roomw.memory.controllerInfo = {};
      if (this.roomw.controller) {
        const container = this.roomw.controller.pos.findInRange(FIND_STRUCTURES, 1, {
          filter: (c) => c.structureType == STRUCTURE_CONTAINER
        });
        if (container.length > 0) {
          this.roomw.memory.controllerInfo.containerPos = container[0].pos;
        }
      }
    }
    if (!this.roomw.memory.sourceInfo) {
      this.roomw.memory.sourceInfo = {};
      const sources = this.roomw.find(FIND_SOURCES);
      for (let i = 0; i < sources.length; i++) {
        this.roomw.memory.sourceInfo[sources[i].id] = {
          sourceId: sources[i].id,
          controllerRoadComplete: false,
          spawnRoadComplete: false
        };
      }

      // add source container id if complete
      const sourceMemory = this.roomw.memory.sourceInfo;
      sources.forEach((s) => {
        const containerPos = sourceMemory[s.id].containerPos;
        if(containerPos && !sourceMemory[s.id].containerId) {
          sourceMemory[s.id].containerId = this.getContainerIdAt(containerPos);
        }
      });
    }
  }

  private getContainerIdAt(containerPos: RoomPosition): string | undefined {
    const container = containerPos.lookFor(LOOK_STRUCTURES).filter((s) => s.structureType == STRUCTURE_CONTAINER);
    if(container.length > 0) {
      return container[0].id;
    }
    return undefined;
  }
}
