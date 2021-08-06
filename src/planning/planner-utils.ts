import { Constants } from "../constants";
import { StructurePlan } from "planning/structure-plan";
import { RoomWrapper } from "structures/room-wrapper";

export class PlannerUtils {
  public constructor(private readonly room: Room) {}

  public static unpackPositionString(positionString: string): RoomPosition {
    const positionArray: string[] = positionString.split(":");
    return new RoomPosition(Number(positionArray[0]), Number(positionArray[1]), positionArray[2]);
  }

  // TODO: don't assume spawn for center
  public static findSiteForPattern(pattern: string[], room: Room): StructurePlan {
    const structurePlan = StructurePlan.buildStructurePlan(pattern, room);
    const patternWidth = structurePlan.getWidth();
    const patternHeight = structurePlan.getHeight();
    const searchWidth = Constants.ROOM_SIZE - 1 - patternWidth;
    const searchHeight = Constants.ROOM_SIZE - 1 - patternHeight;
    let closestSite: { x: number; y: number } | undefined;
    let shortestRange: number = Constants.MAX_DISTANCE;

    // search whole room
    for (let x = 1; x < searchWidth; x++) {
      for (let y = 1; y < searchHeight; y++) {
        const range = this.getPatternRangeFromSpawn(x, patternWidth, y, patternHeight, room);
        if (range) {
          if (range >= shortestRange) {
            continue;
          } else if (structurePlan.translate(x, y)) {
            shortestRange = range;
            closestSite = { x, y };
          }
        }
      }
    }

    // return best site found
    if (closestSite) {
      structurePlan.translate(closestSite.x, closestSite.y);
      console.log(`closest site: ${closestSite.x},${closestSite.y}`);
    } else {
      console.log(`No site for pattern found.`);
    }
    return structurePlan;
  }

  // TODO allow range check from other position
  public static getPatternRangeFromSpawn(
    x: number,
    patternWidth: number,
    y: number,
    patternHeight: number,
    room: Room
  ): number | undefined {
    // use center of pattern for ranging
    const posCenter = room.getPositionAt(x + patternWidth / 2, y + patternHeight / 2);
    const closestSpawn = posCenter?.findClosestByRange(FIND_MY_SPAWNS);
    if (closestSpawn) {
      return posCenter?.getRangeTo(closestSpawn);
    }
    return undefined;
  }

  public static placeStructureAdjacent(
    position: RoomPosition,
    structureConstant: BuildableStructureConstant
  ): string | null {
    let xOffset = 0;
    let yOffset = 0;
    const startPos = new RoomPosition(position.x - 1, position.y - 1, position.roomName);
    let pos = startPos;
    while (pos.createConstructionSite(structureConstant) !== OK) {
      if (xOffset < 2 && yOffset === 0) {
        xOffset++;
      } else if (xOffset === 2 && yOffset < 2) {
        yOffset++;
      } else if (xOffset > 0 && yOffset === 2) {
        xOffset--;
      } else if (xOffset === 0 && yOffset > 0) {
        yOffset--;
      }

      // Give up if back to start position
      if (xOffset === yOffset && xOffset === 0) {
        return null;
      }

      pos = new RoomPosition(startPos.x + xOffset, startPos.y + yOffset, startPos.roomName);
    }

    const structure = pos.lookFor(LOOK_CONSTRUCTION_SITES);
    if (structure.length > 0) {
      return structure[0].id;
    }
    return null;
  }

  public static getPositionSpiral(centerPos: RoomPosition, maxRange: number): RoomPosition[] {
    const line: RoomPosition[] = [];
    let x = 0;
    let y = 0;
    let dx = 0;
    let dy = -1;
    let pos: RoomPosition = new RoomPosition(centerPos.x, centerPos.y, centerPos.roomName);

    for (let i = 0; i < Math.pow(maxRange * 2, 2); i++) {
      if (
        centerPos.x + x < Constants.ROOM_SIZE - 2 &&
        centerPos.x + x > 1 &&
        centerPos.y + y < Constants.ROOM_SIZE - 2 &&
        centerPos.y + y > 1
      ) {
        pos = new RoomPosition(centerPos.x + x, centerPos.y + y, centerPos.roomName);
        line.push(pos);
      }

      if (x === y || (x === -y && x < 0) || (x === 1 - y && x > 0)) {
        const temp = dx;
        dx = -dy;
        dy = temp;
      }

      x = x + dx;
      y = y + dy;
    }
    return line;
  }

  public static findColonyCenter(room: Room): RoomPosition {
    const myStructures = room.find(FIND_MY_STRUCTURES, {
      filter: s =>
        s.structureType !== STRUCTURE_EXTENSION &&
        s.structureType !== STRUCTURE_SPAWN &&
        s.structureType !== STRUCTURE_CONTROLLER
    });
    const myRoadsAndContainers = room.find(FIND_STRUCTURES, {
      filter: s =>
        s.structureType === STRUCTURE_CONTAINER ||
        s.structureType === STRUCTURE_ROAD ||
        s.structureType === STRUCTURE_WALL
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
    const centerPos = new RoomPosition(x / count, y / count, room.name);
    return centerPos;
  }

  public static refreshSourceMemory(room: Room): void {
    // init source memory
    if (!room.memory.sourceInfo) {
      console.log(`- add sourceInfo`);
      room.memory.sourceInfo = {};
    }

    // add all sources
    const sources = room.find(FIND_SOURCES);
    for (const source of sources) {
      if (!room.memory.sourceInfo[source.id]) {
        console.log(`- add source`);
        room.memory.sourceInfo[source.id] = {
          sourceId: source.id
        };
      }
    }

    // refresh each source
    const sourceMemory = room.memory.sourceInfo;
    sources.forEach(source => {
      // validate container id
      if (sourceMemory[source.id].containerId) {
        if (!Game.getObjectById(sourceMemory[source.id].containerId as Id<StructureContainer>)) {
          console.log(`- remove invalid container id`);
          room.memory.sourceInfo[source.id].containerId = undefined;
        }
      }

      // validate minder id
      if (sourceMemory[source.id].minderId) {
        if (!Game.getObjectById(sourceMemory[source.id].minderId as Id<Creep>)) {
          console.log(`- remove invalid minder id`);
          room.memory.sourceInfo[source.id].minderId = undefined;
        }
      }

      // find new containers
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

  public static refreshControllerMemory(room: Room): void {
    if (room.controller) {
      // init controller memory
      if (!room.memory.controllerInfo) {
        console.log(`- add controllerInfo`);
        room.memory.controllerInfo = [];
      }

      // validate controller memory
      const controllerInfo: ContainerInfo[] = room.memory.controllerInfo;
      room.memory.controllerInfo = controllerInfo
        .filter(
          (containerInfo: ContainerInfo) => !!Game.getObjectById(containerInfo.containerId as Id<StructureContainer>)
        )
        .map(containerInfo => {
          if (containerInfo.minderId) {
            if (!Game.getObjectById(containerInfo.minderId as Id<Creep>)) {
              console.log(`- remove invalid minder id`);
              containerInfo.minderId = undefined;
            }
          }
          return containerInfo;
        });

      // find new controller containers
      const containersFound = room.controller.pos.findInRange(FIND_STRUCTURES, 1, {
        filter: c => c.structureType === STRUCTURE_CONTAINER
      });

      // add new controller containers
      for (const container of containersFound) {
        if (!room.memory.controllerInfo.find(c => c.containerId === container.id)) {
          console.log(`- add controller container`);
          room.memory.controllerInfo.push({ containerId: container.id });
        }
      }
    }
  }

  public static initRoomMemory(room: Room): void {
    this.refreshControllerMemory(room);
    this.refreshSourceMemory(room);
  }
}
