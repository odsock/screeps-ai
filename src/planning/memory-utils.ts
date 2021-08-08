export class MemoryUtils {
  // TODO: refactor memory init to new class
  public static refreshRoomMemory(room: Room): void {
    this.refreshContainerMemory(room);
  }

  public static refreshContainerMemory(room: Room): void {
    // init container memory
    if (!room.memory.containers) {
      console.log(`- add container memory`);
      room.memory.containers = [];
    }

    // add missing containers
    room
      .find(FIND_STRUCTURES, {
        filter: c => c.structureType === STRUCTURE_CONTAINER
      })
      .forEach(container => {
        if (!room.memory.containers.find(containerInfo => containerInfo.containerId === container.id)) {
          room.memory.containers.push({ containerId: container.id, nextToController: false, nextToSource: false });
        }
      });

    // validate containers and minders
    const currentContainerMemory = room.memory.containers;
    room.memory.containers = currentContainerMemory
      // drop containers that don't exist
      .filter(containerInfo => !!Game.getObjectById(containerInfo.containerId as Id<StructureContainer>))
      // remove id's for minders that don't exist
      .map(containerInfo => {
        if (containerInfo.minderId) {
          if (!Game.getObjectById(containerInfo.minderId as Id<Creep>)) {
            containerInfo.minderId = undefined;
          }
        }
        return containerInfo;
      })
      // mark containers next to sources
      .map(containerInfo => {
        containerInfo.nextToSource = false;
        const container = Game.getObjectById(containerInfo.containerId as Id<StructureContainer>);
        if (container) {
          const sources = container.pos.findInRange(FIND_SOURCES, 1);
          if (sources.length > 0) {
            containerInfo.nextToSource = true;
          }
        }
        return containerInfo;
      })
      // mark containers next to controllers
      .map(containerInfo => {
        containerInfo.nextToController = false;
        if (room.controller && !containerInfo.nextToSource) {
          const containers = room.controller.pos.findInRange(FIND_STRUCTURES, 1, {
            filter: c => c.structureType === STRUCTURE_CONTAINER && c.id === containerInfo.containerId
          });
          if (containers.length > 0) {
            containerInfo.nextToController = true;
          }
        }
        return containerInfo;
      });
  }
}
