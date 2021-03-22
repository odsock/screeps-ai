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
      return container;
    }
    return null;
  }

  protected claimFreeSourceContainer(): ScreepsReturnCode {
    const sourceMemory = this.room.memory.sourceInfo;

    let freeSources: SourceInfo[] = [];
    for (let sourceId in sourceMemory) {
      if (sourceMemory[sourceId].containerId && !sourceMemory[sourceId].minderId) {
        freeSources.push(sourceMemory[sourceId]);
      }
    }

    const freeContainers = freeSources.flatMap((sourceInfo) => {
      const container = Game.getObjectById(sourceInfo.containerId as Id<StructureContainer>);
      return container ? [container] : [];
    });

    const closestFreeContainer = this.pos.findClosestByPath(freeContainers);
    const sourceInfo = freeSources.find((sourceInfo) => sourceInfo.containerId == closestFreeContainer?.id);
    CreepUtils.consoleLogIfWatched(this, `closest free container: ${closestFreeContainer?.pos}`);

    if (sourceInfo && closestFreeContainer) {
      this.room.memory.sourceInfo[sourceInfo.sourceId].minderId = this.id;
      this.memory.containerId = closestFreeContainer.id;
      return OK;
    }
    return ERR_NOT_FOUND;
  }

  protected claimFreeControllerContainer(): ScreepsReturnCode {
    const controllerInfo = this.room.memory.controllerInfo;
    if(controllerInfo.containerId && !controllerInfo.minderId) {
      this.room.memory.controllerInfo.minderId = this.id;
      this.memory.containerId = controllerInfo.containerId as Id<StructureContainer>;
      return OK;
    }
    return ERR_NOT_FOUND;
  }

  protected moveToMyContainer(): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `moving to container`);
    let container = this.getMyContainer();
    if (container) {
      return this.moveTo(container, { visualizePathStyle: { stroke: '#ffaa00' } });
    }
    return ERR_NOT_FOUND;
  }

  get onMyContainer(): boolean {
    const container = this.getMyContainer();
    return !!container && this.pos.isEqualTo(container.pos);
  }
}
