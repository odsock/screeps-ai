import { CreepUtils } from "creep-utils";
import { CreepWrapper } from "./creep-wrapper";

export abstract class Minder extends CreepWrapper {
  public run(): void {
    this.moveToDestination();

    // retire old creep if valid retiree set
    if (this.memory.retiree) {
      const retiree = Game.creeps[this.memory.retiree];
      if (retiree) {
        this.retireCreep(retiree);
        return;
      } else {
        this.memory.retiree = undefined;
      }
    }

    // harvest then transfer until container and store is full or source is inactive
    if (this.harvestFromNearbySource() === OK && this.fillContainer() === OK) {
      return;
    }

    // build, repair, or upgrade
    if (
      this.buildNearbySite() !== ERR_NOT_FOUND ||
      this.repairNearbySite() !== ERR_NOT_FOUND ||
      this.upgrade() !== ERR_NOT_FOUND
    ) {
      this.withdrawFromMyContainer();
      return;
    }

    CreepUtils.consoleLogIfWatched(this, `stumped. sitting like a lump`);
  }

  private retireCreep(retiree: Creep): ScreepsReturnCode {
    // call for tug if no haul target set
    if (!this.memory.haulRequested) {
      this.callHauler();
    }
    // request suicide if next to retiree
    if (retiree.pos.isNearTo(this.pos)) {
      const result = retiree.suicide();
      CreepUtils.consoleLogIfWatched(this, `requested retirement of ${retiree.name}`, result);
      this.memory.retiree = undefined;
      return result;
    }
    return OK;
  }

  /** use hauler creep to pull to destination */
  public abstract moveToDestination(): ScreepsReturnCode;

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

  protected cancelHauler(): void {
    this.memory.haulRequested = false;
    this.memory.haulerName = undefined;
  }

  protected waitingForTug(): boolean {
    return !!this.memory.haulRequested;
  }

  protected callHauler(): void {
    CreepUtils.consoleLogIfWatched(this, `calling for tug`);
    this.memory.haulRequested = true;
  }
}
