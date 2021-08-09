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
          room.memory.containers.push({
            containerId: container.id,
            nearController: false,
            nearSource: false,
            creepClaims: []
          });
        }
      });

    // validate containers and claims
    const currentContainerMemory = room.memory.containers;
    room.memory.containers = currentContainerMemory
      // drop containers that don't exist
      .filter(containerInfo => !!Game.getObjectById(containerInfo.containerId as Id<StructureContainer>))
      // remove id's for creeps that don't exist
      .map(containerInfo => {
        if (containerInfo.minderId) {
          if (!Game.getObjectById(containerInfo.minderId as Id<Creep>)) {
            containerInfo.minderId = undefined;
          }
        }
        // TODO validate claims array
        // for (const claim of containerInfo.creepClaims) {
        //   if (!Game.getObjectById(claim.id as Id<Creep>)) {
        //     containerInfo.creepClaims[claim] = undefined;
        //   }
        // }
        return containerInfo;
      })
      // mark containers next to sources
      .map(containerInfo => {
        containerInfo.nearSource = false;
        const container = Game.getObjectById(containerInfo.containerId as Id<StructureContainer>);
        if (container) {
          const sources = container.pos.findInRange(FIND_SOURCES, 1);
          if (sources.length > 0) {
            containerInfo.nearSource = true;
          }
        }
        return containerInfo;
      })
      // mark containers next to controllers
      .map(containerInfo => {
        containerInfo.nearController = false;
        if (room.controller && !containerInfo.nearSource) {
          const containers = room.controller.pos.findInRange(FIND_STRUCTURES, 1, {
            filter: c => c.structureType === STRUCTURE_CONTAINER && c.id === containerInfo.containerId
          });
          if (containers.length > 0) {
            containerInfo.nearController = true;
          }
        }
        return containerInfo;
      });
  }
}