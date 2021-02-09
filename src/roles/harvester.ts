export class Harvester {
  private creep: Creep;

  constructor(creep: Creep) {
    this.creep = creep;
  }

  // TODO: make harvester harvest/build/repair/upgrade if in range of its container
  public run() {
    if (this.creep.memory.retiree) {
      this.moveToRetiree();
    }
    else if (!this.getMyContainer()) {
      this.moveToFreeContainer();
    }
    else if (this.creep.pos.findInRange(FIND_SOURCES, 1)) {
      this.fillContainer();
    }
    else if (this.creep.room.controller && this.creep.pos.isNearTo(this.creep.room.controller.pos)) {
      this.creep.upgradeController(this.creep.room.controller);
    }
  }

  private moveToRetiree() {
    const retireeName = this.creep.memory.retiree as string;
    const retiree = Game.creeps[retireeName];
    if (retiree) {
      const result = this.creep.moveTo(retiree.pos, { visualizePathStyle: { stroke: '#ffaa00' } });
    }
    else {
      this.creep.memory.retiree = undefined;
    }
  }

  private fillContainer(): ScreepsReturnCode {
    const myContainer = this.getMyContainer();
    if (myContainer && myContainer.store.getFreeCapacity() > 0) {
      let sources = this.creep.pos.findInRange(FIND_SOURCES, 1);
      if (sources.length > 0) {
        return this.creep.harvest(sources[0]);
      }
      return ERR_NOT_IN_RANGE;
    }
    return ERR_NOT_FOUND
  }

  private getMyContainer(): StructureContainer | null {
    if (this.creep.memory.containerId) {
      return Game.getObjectById(this.creep.memory.containerId);
    }
    else {
      let containersHere = this.creep.pos.lookFor(LOOK_STRUCTURES).filter((s) => s.structureType == STRUCTURE_CONTAINER);
      if (containersHere.length > 0) {
        let myContainer = containersHere[0] as StructureContainer;
        this.creep.memory.containerId = myContainer.id;
        return myContainer;
      }
    }
    return null;
  }

  private moveToFreeContainer() {
    let containers = this.creep.room.find(FIND_STRUCTURES, { filter: (structure) => structure.structureType == STRUCTURE_CONTAINER });
    let freeContainers = containers.filter((container) => {
      const creeps = container.pos.lookFor(LOOK_CREEPS);
      if (creeps.length > 0 && creeps[0].memory.role == 'harvester') {
        return false;
      }
      return true;
    });
    if (freeContainers) {
      this.creep.moveTo(freeContainers[0], { visualizePathStyle: { stroke: '#ffaa00' } });
    }
  }
}
