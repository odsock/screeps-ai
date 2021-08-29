import { CreepUtils } from "creep-utils";
import { CreepRole } from "../population-control";
import { CreepWrapper } from "./creep-wrapper";

export class Minder extends CreepWrapper {
  public static readonly ROLE = CreepRole.MINDER;
  public static readonly BODY_PROFILE: CreepBodyProfile = {
    profile: [WORK],
    seed: [MOVE, CARRY],
    maxBodyParts: 10
  };

  public run(): void {
    this.touchRoad();

    // move to retire old creep
    if (this.memory.retiree) {
      if (this.moveToRetiree() !== ERR_NOT_FOUND) {
        return;
      }
    }

    // claim container if free
    if (!this.getMyContainer()) {
      const claimSourceResult = this.claimFreeSourceContainerAsMinder();
      CreepUtils.consoleLogIfWatched(this, `claim source container result: ${claimSourceResult}`);
      if (claimSourceResult !== OK) {
        const claimControllerResult = this.claimFreeControllerContainerAsMinder();
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

    // harvest then transfer until container and store is full or source is inactive
    if (this.harvestFromNearbySource() === OK && this.fillContainer() === OK) {
      return;
    }

    // help build if close enough
    // TODO repair if close enough as well
    if (this.buildNearbySite() !== ERR_NOT_FOUND || this.upgrade() !== ERR_NOT_FOUND) {
      this.withdrawFromMyContainer();
      return;
    }

    CreepUtils.consoleLogIfWatched(this, `stumped. sitting like a lump`);
  }

  protected harvestFromNearbySource(): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `harvesting from source`);
    let result: ScreepsReturnCode = ERR_NOT_IN_RANGE;
    const sources = this.pos.findInRange(FIND_SOURCES, 1);
    if (sources.length > 0) {
      result = this.harvest(sources[0]);
    }
    CreepUtils.consoleLogIfWatched(this, `harvest result`, result);
    return result;
  }

  protected fillContainer(): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `filling my container`);
    let result: ScreepsReturnCode = ERR_NOT_FOUND;
    const myContainer = this.getMyContainer();
    if (myContainer) {
      result = this.transfer(myContainer, RESOURCE_ENERGY);
    }
    CreepUtils.consoleLogIfWatched(this, `fill result`, result);
    return result;
  }

  protected buildNearbySite(): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `building nearby site`);
    let result: ScreepsReturnCode = ERR_NOT_FOUND;
    const site = this.pos.findClosestByRange(FIND_MY_CONSTRUCTION_SITES, { filter: { range: 3 } });
    if (site) {
      result = this.build(site);
    }
    CreepUtils.consoleLogIfWatched(this, `build result`, result);
    return result;
  }

  protected repairNearbySite(): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `repairing nearby site`);
    let result: ScreepsReturnCode = ERR_NOT_FOUND;
    const site = this.pos.findClosestByRange(FIND_MY_STRUCTURES, { filter: { range: 3 } });
    if (site) {
      result = this.repair(site);
    }
    CreepUtils.consoleLogIfWatched(this, `repair result`, result);
    return result;
  }

  protected upgrade(): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `upgrading`);
    let result: ScreepsReturnCode = ERR_NOT_FOUND;
    if (this.room.controller && this.pos.inRangeTo(this.room.controller.pos, 3)) {
      result = this.upgradeController(this.room.controller);
    }
    CreepUtils.consoleLogIfWatched(this, `upgrade result`, result);
    return result;
  }

  protected withdrawFromMyContainer(): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `withdrawing`);
    let result: ScreepsReturnCode = ERR_NOT_FOUND;
    if (this.room.controller && this.pos.inRangeTo(this.room.controller.pos, 3)) {
      result = this.withdraw(this.getMyContainer() as StructureContainer, RESOURCE_ENERGY);
    }
    CreepUtils.consoleLogIfWatched(this, `withdraw result`, result);
    return result;
  }
}
