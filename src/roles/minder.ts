import { CreepUtils } from "creep-utils";
import { CreepWrapper } from "./creep-wrapper";

export class Minder extends CreepWrapper {
  public run() {
    super.run();

    if (this.memory.retiree) {
      if (this.moveToRetiree() != ERR_NOT_FOUND) {
        return;
      }
    }

    if (!this.getMyContainer()) {
      if (this.moveToFreeContainer() != ERR_NOT_FOUND) {
        return;
      }
    }

    const site = this.pos.findClosestByRange(FIND_MY_CONSTRUCTION_SITES, { filter: { range: 3 } });
    if (site) {
      this.buildNearbySite(site);
    }
  }

  protected fillContainer(): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `filling my container`);
    const myContainer = this.getMyContainer();
    if (myContainer && myContainer.store.getFreeCapacity() > 0) {
      let sources = this.pos.findInRange(FIND_SOURCES, 1);
      if (sources.length > 0) {
        this.harvest(sources[0]);
        return this.transfer(myContainer, RESOURCE_ENERGY);
      }
      return ERR_NOT_IN_RANGE;
    }
    return ERR_NOT_FOUND
  }

  protected buildNearbySite(site: ConstructionSite<BuildableStructureConstant>) {
    const withdrawResult = this.withdraw(this.getMyContainer() as StructureContainer, RESOURCE_ENERGY);
    CreepUtils.consoleLogIfWatched(this, `withdraw: ${withdrawResult}`);
    const result = this.build(site);
    CreepUtils.consoleLogIfWatched(this, `build: ${result}`);
    return result;
  }

  protected withdrawAndUpgrade(): ScreepsReturnCode {
    if (this.room.controller && this.pos.inRangeTo(this.room.controller.pos, 3)) {
      const withdrawResult = this.withdraw(this.getMyContainer() as StructureContainer, RESOURCE_ENERGY);
      CreepUtils.consoleLogIfWatched(this, `withdraw: ${withdrawResult}`);
      const result = this.upgradeController(this.room.controller);
      CreepUtils.consoleLogIfWatched(this, `upgrade: ${result}`);
      return result;
    }
    return ERR_NOT_FOUND;
  }

  protected moveToRetiree(): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `moving to retiree`);
    const retireeName = this.memory.retiree as string;
    const retiree = Game.creeps[retireeName];
    if (retiree) {
      return this.moveTo(retiree.pos, { visualizePathStyle: { stroke: '#ffaa00' } });
    }
    else {
      this.memory.retiree = undefined;
      return ERR_NOT_FOUND;
    }
  }

  protected getMyContainer(): StructureContainer | null {
    if (this.memory.containerId) {
      const container = Game.getObjectById(this.memory.containerId);
      if (!container) {
        CreepUtils.consoleLogIfWatched(this, `container id invalid`);
        this.memory.containerId = undefined;
      }
      else {
        return container;
      }
    }

    CreepUtils.consoleLogIfWatched(this, `searching for container`);
    let containersHere = this.pos.lookFor(LOOK_STRUCTURES).filter((s) => s.structureType == STRUCTURE_CONTAINER);
    if (containersHere.length > 0) {
      const myContainer = containersHere[0] as StructureContainer;
      this.memory.containerId = myContainer.id;
      return myContainer;
    }
    return null;
  }

  protected findFreeSourceContainer(): StructureContainer | null {
    const sourceMemory = this.roomw.memory.sourceInfo;
    const freeContainers = Object.keys(sourceMemory)
      .filter((sourceId) => {
        sourceMemory[sourceId].containerId
          && !(sourceMemory[sourceId].minderId && Game.getObjectById(sourceMemory[sourceId].minderId as Id<Creep>))
      })
      .flatMap((sourceId) => {
        const container = Game.getObjectById(sourceMemory[sourceId].containerId as Id<StructureContainer>);
        return container ? [container] : [];
      });
    return this.pos.findClosestByPath(freeContainers);
  }

  protected moveToFreeContainer(): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `moving to container`);
    let freeContainer = this.findFreeSourceContainer();
    if (freeContainer) {
      return this.moveTo(freeContainer, { visualizePathStyle: { stroke: '#ffaa00' } });
    }
    return ERR_NOT_FOUND;
  }


  private findContainerWithoutHarvester(containers: StructureContainer[]) {
    return containers.filter((container) => {
      const creeps = container.pos.lookFor(LOOK_CREEPS);
      if (creeps.length > 0 && creeps[0].memory.role == 'harvester') {
        return false;
      }
      return true;
    });
  }
}
