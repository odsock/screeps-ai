import { RoomWrapper } from "structures/room-wrapper";
import { ContainerPlan } from "./container-plan";
import { ExtensionPlan } from "./extension-plan";
import { RoadPlan } from "./road-plan";

export class Planner {
  private readonly room: RoomWrapper;

  public constructor(room: Room) {
    this.room = new RoomWrapper(room);
  }

  public run(): ScreepsReturnCode {
    this.setupRoomMemory();

    if (this.room.controller && this.room.controller?.level >= 2) {
      console.log(`${this.room.name}: running planning`);

      // place available extensions
      const extensionPlan = new ExtensionPlan(this.room);
      let result = extensionPlan.planExtensionGroup();
      if (result !== OK) {
        return result;
      }

      // place source containers
      const containerPlan = new ContainerPlan(this.room);
      result = containerPlan.placeSourceContainer();
      if (result !== OK) {
        return result;
      }

      // place controller container
      result = containerPlan.placeControllerContainer();
      if (result !== OK) {
        return result;
      }

      // place road from source container to controller container
      const roadPlan = new RoadPlan(this.room);
      roadPlan.placeRoadSourceContainerToControllerContainer();
      if (result !== OK) {
        return result;
      }

      // TODO: place ramparts over containers
    }
    return OK;
  }

  // TODO: refactor memory init to new class
  public setupRoomMemory(): void {
    console.log(`setup room memory`);
    if (!this.room.memory.controllerInfo) {
      console.log(`- add controllerInfo`);
      this.room.memory.controllerInfo = {};
    }

    const controllerInfo = this.room.memory.controllerInfo;
    // if there is a controller container id set validate it
    if (controllerInfo.containerId) {
      const container = Game.getObjectById(controllerInfo.containerId as Id<StructureContainer>);
      if (!container) {
        console.log(`- remove invalid container id`);
        this.room.memory.controllerInfo.containerId = undefined;
      }
    }

    if (this.room.controller) {
      const container = this.room.controller.pos.findInRange(FIND_STRUCTURES, 1, {
        filter: c => c.structureType === STRUCTURE_CONTAINER
      });
      // TODO: more than one controller container?
      if (container.length > 0) {
        console.log(`- add controller container`);
        this.room.memory.controllerInfo.containerId = container[0].id;
      }
    }

    if (!this.room.memory.sourceInfo) {
      console.log(`- add sourceInfo`);
      this.room.memory.sourceInfo = {};
    }
    
    const sources = this.room.find(FIND_SOURCES);
    for (const source of sources) {
      if (!this.room.memory.sourceInfo[source.id]) {
        console.log(`- add source`);
        this.room.memory.sourceInfo[source.id] = {
          sourceId: source.id
        };
      }
    }

    // TODO: move source container memory somewhere else
    // add source container id if complete
    const sourceMemory = this.room.memory.sourceInfo;
    console.log(`- add source containers`);
    sources.forEach(source => {
      const containers = source.pos.findInRange(FIND_STRUCTURES, 1, {
        filter: c => c.structureType === STRUCTURE_CONTAINER
      });
      // TODO: multiple source containers?
      if (containers.length > 0 && !sourceMemory[source.id]?.containerId) {
        console.log(`- new container found`);
        sourceMemory[source.id].containerId = containers[0].id;
      }
    });
  }

  private getContainerIdAt(containerPos: RoomPosition): string | undefined {
    const container = containerPos.lookFor(LOOK_STRUCTURES).filter(s => s.structureType == STRUCTURE_CONTAINER);
    if (container.length > 0) {
      return container[0].id;
    }
    return undefined;
  }
}
