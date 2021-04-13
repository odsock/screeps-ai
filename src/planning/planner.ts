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

        // TODO: place ramparts over containers
      }
    }
    return OK;
  }
  private placeFirstSpawn(): ScreepsReturnCode {

  }

  // TODO: refactor memory init to new class
  public setupRoomMemory(): void {
    console.log(`setup room memory`);
    if (this.room.controller) {
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

      if (!controllerInfo.containerId) {
        const container = this.room.controller.pos.findInRange(FIND_STRUCTURES, 1, {
          filter: c => c.structureType === STRUCTURE_CONTAINER
        });
        // TODO: more than one controller container?
        if (container.length > 0) {
          console.log(`- add controller container`);
          this.room.memory.controllerInfo.containerId = container[0].id;
        }
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
    sources.forEach(source => {
      // if there is a container id set validate it
      if (sourceMemory[source.id].containerId) {
        const container = Game.getObjectById(sourceMemory[source.id].containerId as Id<StructureContainer>);
        if (!container) {
          console.log(`- remove invalid container id`);
          this.room.memory.sourceInfo[source.id].containerId = undefined;
        }
      }

      // if there is a minder id set validate it
      if (sourceMemory[source.id].minderId) {
        const creep = Game.getObjectById(sourceMemory[source.id].minderId as Id<Creep>);
        if (!creep) {
          console.log(`- remove invalid minder id`);
          this.room.memory.sourceInfo[source.id].minderId = undefined;
        }
      }

      const containers = source.pos.findInRange(FIND_STRUCTURES, 1, {
        filter: c => c.structureType === STRUCTURE_CONTAINER
      });
      // TODO: multiple source containers?
      if (containers.length > 0 && !sourceMemory[source.id]?.containerId) {
        console.log(`- add source containers`);
        sourceMemory[source.id].containerId = containers[0].id;
      }
    });
  }

  private getContainerIdAt(containerPos: RoomPosition): string | undefined {
    const container = containerPos.lookFor(LOOK_STRUCTURES).filter(s => s.structureType === STRUCTURE_CONTAINER);
    if (container.length > 0) {
      return container[0].id;
    }
    return undefined;
  }
}
