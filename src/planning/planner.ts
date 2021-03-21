import { CreepUtils } from "creep-utils";
import { RoomWrapper } from "structures/room-wrapper";
import { ContainerPlan } from "./container-plan";
import { ExtensionPlan } from "./extension-plan";
import { RoadPlan } from "./road-plan";

export class Planner {
  private readonly room: Room;

  constructor(room: Room) {
    this.room = room;
  }

  run(): ScreepsReturnCode {
    this.setupRoomMemory();

    if (this.room.controller && this.room.controller?.level >= 2) {
      console.log(`${this.room.name}: running planning`);

      // place available extensions
      let extensionPlan = new ExtensionPlan(this.room);
      let result = extensionPlan.planExtensionGroup();
      if (result != OK) {
        return result;
      }

      // place source containers
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

      // place road from source container to controller container
      let roadPlan = new RoadPlan(this.room);
      roadPlan.placeRoadSourceContainerToController();
      if (result != OK) {
        return result;
      }

      // TODO: place ramparts over containers
    }
    return OK;
  }

  // TODO: refactor memory init to new class
  public setupRoomMemory() {
    if (!this.room.memory.controllerInfo) {
      this.room.memory.controllerInfo = {};
      if (this.room.controller) {
        const container = this.room.controller.pos.findInRange(FIND_STRUCTURES, 1, {
          filter: (c) => c.structureType == STRUCTURE_CONTAINER
        });
        if (container.length > 0) {
          this.room.memory.controllerInfo.containerPos = container[0].pos;
        }
      }
    }

    const controllerInfo = this.room.memory.controllerInfo;
    if (controllerInfo.containerPos && !controllerInfo.containerId) {
      this.room.memory.controllerInfo.containerId = this.getContainerIdAt(new RoomPosition(controllerInfo.containerPos.x, controllerInfo.containerPos.y, controllerInfo.containerPos.roomName));
    }

    const sources = this.room.find(FIND_SOURCES);

    if (!this.room.memory.sourceInfo) {
      this.room.memory.sourceInfo = {};
      for (let i = 0; i < sources.length; i++) {
        this.room.memory.sourceInfo[sources[i].id] = {
          sourceId: sources[i].id,
          controllerRoadComplete: false,
          spawnRoadComplete: false
        };
      }

    }

    // TODO: move source container memory somewhere else
    // add source container id if complete
    const sourceMemory = this.room.memory.sourceInfo;
    sources.forEach((s) => {
      const containerPos = sourceMemory[s.id].containerPos;
      if (containerPos && !sourceMemory[s.id].containerId) {
        sourceMemory[s.id].containerId = this.getContainerIdAt(new RoomPosition(containerPos.x, containerPos.y, containerPos.roomName));
      }
    });
  }

  private getContainerIdAt(containerPos: RoomPosition): string | undefined {
    const container = containerPos.lookFor(LOOK_STRUCTURES).filter((s) => s.structureType == STRUCTURE_CONTAINER);
    if (container.length > 0) {
      return container[0].id;
    }
    return undefined;
  }
}
