export class Harvester {
  private creep: Creep;

  constructor(creep: Creep) {
    this.creep = creep;
  }

  public run() {
    let myContainer = this.getMyContainer();
    if (myContainer) {
      this.fillContainer(myContainer);
    }
    else {
      this.moveToUnoccupiedContainer();
    }
  }

  private fillContainer(myContainer: StructureContainer) {
    if (myContainer.store.getFreeCapacity() > 0) {
      let sources = this.creep.pos.findInRange(FIND_SOURCES, 1);
      this.creep.harvest(sources[0]);
    }
  }

  private getMyContainer() {
    let containersHere = this.creep.room.lookForAt(LOOK_STRUCTURES, this.creep.pos).filter((s) => s.structureType == STRUCTURE_CONTAINER);
    let myContainer = containersHere?.[0] as StructureContainer;
    return myContainer;
  }

  private moveToUnoccupiedContainer() {
    let containers = this.creep.room.find(FIND_STRUCTURES, { filter: (structure) => structure.structureType == STRUCTURE_CONTAINER });
    let unoccupiedContainers = containers.filter((container) => container.room.lookForAt(LOOK_CREEPS, container.pos).length == 0);
    if (unoccupiedContainers) {
      this.creep.moveTo(unoccupiedContainers[0], { visualizePathStyle: { stroke: '#ffaa00' } });
    }
  }
}