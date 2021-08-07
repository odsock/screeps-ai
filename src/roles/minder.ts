import { CreepUtils } from "creep-utils";
import { PlannerUtils } from "planning/planner-utils";
import { CreepWrapper } from "./creep-wrapper";

export class Minder extends CreepWrapper {
  public run(): void {
    this.touchRoad();

    // move to retire old creep
    if (this.memory.retiree) {
      if (this.moveToRetiree() !== ERR_NOT_FOUND) {
        return;
      }
    }

    // help build if close enough
    const site = this.pos.findClosestByRange(FIND_MY_CONSTRUCTION_SITES, { filter: { range: 3 } });
    if (site) {
      this.buildNearbySite(site);
    }

    // claim container if free
    if (!this.getMyContainer()) {
      const claimSourceResult = this.claimFreeSourceContainer();
      CreepUtils.consoleLogIfWatched(this, `claim source container result: ${claimSourceResult}`);
      if (claimSourceResult !== OK) {
        const claimControllerResult = this.claimFreeControllerContainer();
        CreepUtils.consoleLogIfWatched(this, `claim controller container result: ${claimControllerResult}`);
        if (claimControllerResult !== OK) {
          CreepUtils.consoleLogIfWatched(this, `no free containers`);
          return;
        }
      }
    }

    // move to claimed container
    if (!this.onMyContainer) {
      if (this.moveToMyContainer() === ERR_NOT_FOUND) {
        CreepUtils.consoleLogIfWatched(this, `container is missing`);
        return;
      }
    }

    // try to harvest from source
    if (this.fillContainer() === OK) {
      return;
    }

    // try to upgrade controller
    if (this.withdrawAndUpgrade() === OK) {
      return;
    }

    CreepUtils.consoleLogIfWatched(this, `stumped. sitting like a lump`);
  }

  protected fillContainer(): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `filling my container`);
    const myContainer = this.getMyContainer();
    if (myContainer && myContainer.store.getFreeCapacity() > 0) {
      const sources = this.pos.findInRange(FIND_SOURCES, 1);
      if (sources.length > 0) {
        this.harvest(sources[0]);
        return this.transfer(myContainer, RESOURCE_ENERGY);
      }
      CreepUtils.consoleLogIfWatched(this, `no source in range for harvest`);
      return ERR_NOT_IN_RANGE;
    }
    CreepUtils.consoleLogIfWatched(this, `no container in range with space`);
    return ERR_NOT_FOUND;
  }

  protected buildNearbySite(site: ConstructionSite<BuildableStructureConstant>): ScreepsReturnCode {
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
    CreepUtils.consoleLogIfWatched(this, `no controller in range for upgrade`);
    return ERR_NOT_FOUND;
  }

  protected moveToRetiree(): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `moving to retiree`);
    const retireeName = this.memory.retiree as string;
    const retiree = Game.creeps[retireeName];
    if (retiree) {
      return this.moveTo(retiree.pos, { visualizePathStyle: { stroke: "#ffaa00" } });
    } else {
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
    PlannerUtils.refreshContainerMemory(this.room);
    const containerInfo = this.room.memory.containers.find(info => info.nextToSource && !info.minderId);
    if (containerInfo) {
      containerInfo.minderId = this.id;
      this.memory.containerId = containerInfo.containerId as Id<StructureContainer>;
      return OK;
    }
    return ERR_NOT_FOUND;
  }

  protected claimFreeControllerContainer(): ScreepsReturnCode {
    PlannerUtils.refreshContainerMemory(this.room);
    const containerInfo = this.room.memory.containers.find(info => info.nextToController && !info.minderId);
    if (containerInfo) {
      containerInfo.minderId = this.id;
      this.memory.containerId = containerInfo.containerId as Id<StructureContainer>;
      return OK;
    }
    return ERR_NOT_FOUND;
  }

  protected moveToMyContainer(): ScreepsReturnCode {
    const container = this.getMyContainer();
    CreepUtils.consoleLogIfWatched(this, `moving to container: ${String(container)}`);
    if (container) {
      return this.moveTo(container, { visualizePathStyle: { stroke: "#ffaa00" } });
    }
    return ERR_NOT_FOUND;
  }

  protected get onMyContainer(): boolean {
    const container = this.getMyContainer();
    return !!container && this.pos.isEqualTo(container.pos);
  }
}
