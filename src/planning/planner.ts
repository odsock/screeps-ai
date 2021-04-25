import { Constants } from "../constants";
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
    if (this.room.controller) {
      // init controller info
      if (!this.room.memory.controllerInfo) {
        console.log(`- add controllerInfo`);
        this.room.memory.controllerInfo = [];
      }

      // validate controller containers
      const controllerInfo = this.room.memory.controllerInfo.filter(containerInfo =>
        Game.getObjectById(containerInfo.containerId as Id<StructureContainer>)
      );
      this.room.memory.controllerInfo = controllerInfo;

      // find new controller containers
      const containersFound = this.room.controller.pos.findInRange(FIND_STRUCTURES, 1, {
        filter: c => c.structureType === STRUCTURE_CONTAINER
      });

      // add new controller containers
      for (const container of containersFound) {
        console.log(`- add controller container`);
        this.room.memory.controllerInfo.push({ containerId: container.id });
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

  private placeTower(): ScreepsReturnCode {
    const myStructures = this.room.find(FIND_MY_STRUCTURES, {
      filter: s => s.structureType !== STRUCTURE_EXTENSION && s.structureType !== STRUCTURE_SPAWN
    });
    const myRoadsAndContainers = this.room.find(FIND_STRUCTURES, {
      filter: s => {
        s.structureType === STRUCTURE_CONTAINER ||
          s.structureType === STRUCTURE_ROAD ||
          s.structureType === STRUCTURE_WALL;
      }
    });
    const structures = myRoadsAndContainers.concat(myStructures);

    let x = 0;
    let y = 0;
    let count = 0;
    for (const structure of structures) {
      x += structure.pos.x;
      y += structure.pos.y;
      count++;
    }
    const centerPos = new RoomPosition(x / count, y / count, this.room.name);
    let towerPos = centerPos;
    let xOffset = 0;
    let yOffset = 0;
    let range = 1;

    let line: RoomPosition[] = [];
    let ret: ScreepsReturnCode | null = null;
    while (towerPos.x < Constants.ROOM_SIZE && towerPos.y < Constants.ROOM_SIZE && towerPos.x > 0 && towerPos.y > 0) {
      console.log(`tower site: ${towerPos}, xOffset: ${xOffset}, yOffset: ${yOffset}`);
      line.push(towerPos);
      ret = this.room.createConstructionSite(towerPos, STRUCTURE_TOWER);
      if (ret === OK) {
        break;
      }

      x++
      y++
      x--
      x--
      x--
      y--
      y--
      y--
      x++
      x++
      x++
      y++
      y++
      x++
      y++

      if (xOffset === yOffset) {
        yOffset++;
        range++;
      } else if(xOffset < range && yOffset === -range) {
        xOffset++;
      } else if (xOffset === range && yOffset < range) {
        yOffset++;
      } else if (xOffset > -range && yOffset === range) {
        xOffset--;
      } else if (xOffset === -range && yOffset > -range) {
        yOffset--;
      } else {
        console.log(`breaking loop`);
        break;
      }

      range++;
      
      towerPos.x = centerPos.x + xOffset;
      towerPos.y = centerPos.y + yOffset;
      towerPos = new RoomPosition(towerPos.x, towerPos.y, this.room.name);
    }
    this.room.visual.poly(line);

    if (ret) {
      return ret;
    }
    return ERR_NOT_FOUND;
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
