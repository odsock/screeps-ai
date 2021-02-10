import { CreepUtils } from "creep-utils";

export class Harvester {
  private creep: Creep;

  constructor(creep: Creep) {
    this.creep = creep;
  }

  public run() {
    if (this.creep.memory.retiree) {
      this.moveToRetiree();
    }
    else if (!this.getMyContainer()) {
      this.moveToFreeContainer();
    }
    else if (this.creep.pos.findInRange(FIND_SOURCES, 1).length > 0) {
      this.fillContainer();
    }
    else {
      this.upgradeController();
    }
    CreepUtils.consoleLogIfWatched(this.creep, `stumped. sitting like a lump`);
  }

  private upgradeController() {
    if (this.creep.room.controller && this.creep.pos.inRangeTo(this.creep.room.controller.pos, 3)) {
      const withdrawResult = this.creep.withdraw(this.getMyContainer() as StructureContainer, RESOURCE_ENERGY);
      CreepUtils.consoleLogIfWatched(this.creep, `withdraw: ${withdrawResult}`);
      const result = this.creep.upgradeController(this.creep.room.controller);
      CreepUtils.consoleLogIfWatched(this.creep, `upgrade: ${result}`);
    }
  }

  private moveToRetiree() {
    CreepUtils.consoleLogIfWatched(this.creep, `moving to retiree`);
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
    CreepUtils.consoleLogIfWatched(this.creep, `filling my container`);
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
      const container = Game.getObjectById(this.creep.memory.containerId);
      if (!container) {
        CreepUtils.consoleLogIfWatched(this.creep, `container id invalid`);
        this.creep.memory.containerId = undefined;
      }
      else {
        return container;
      }
    }

    CreepUtils.consoleLogIfWatched(this.creep, `searching for container`);
    let containersHere = this.creep.pos.lookFor(LOOK_STRUCTURES).filter((s) => s.structureType == STRUCTURE_CONTAINER);
    if (containersHere.length > 0) {
      const myContainer = containersHere[0] as StructureContainer;
      this.creep.memory.containerId = myContainer.id;
      return myContainer;
    }
    return null;
  }

  private moveToFreeContainer() {
    CreepUtils.consoleLogIfWatched(this.creep, `moving to container`);
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
