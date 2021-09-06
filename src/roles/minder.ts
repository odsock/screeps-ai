import { CreepUtils } from "creep-utils";
import { MemoryUtils } from "planning/memory-utils";
import { CreepWrapper } from "./creep-wrapper";

export abstract class Minder extends CreepWrapper {
  public run(): void {
    // wait for hauler if not at haul target
    if (this.memory.haulTarget) {
      const targetPos = MemoryUtils.unpackRoomPosition(this.memory.haulTarget);
      if (this.pos.isEqualTo(targetPos)) {
        this.memory.haulTarget = undefined;
      } else {
        return;
      }
    }

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

    // claim container if free
    if (!this.getMyContainer()) {
      this.claimContainer();
    }

    // call for tug if not on container and haven't already called
    if (!this.onMyContainer) {
      const container = this.getMyContainer();
      if (container && !this.memory.haulTarget) {
        this.callForTug(container.pos);
      }
    } else {
      this.memory.haulTarget = undefined;
    }

    // harvest then transfer until container and store is full or source is inactive
    if (this.harvestFromNearbySource() === OK && this.fillContainer() === OK) {
      return;
    }

    // help build if close enough
    // TODO repair if close enough as well
    if (
      this.buildNearbySite() !== ERR_NOT_FOUND ||
      this.upgrade() !== ERR_NOT_FOUND ||
      this.repairNearbySite() !== ERR_NOT_FOUND
    ) {
      this.withdrawFromMyContainer();
      return;
    }

    CreepUtils.consoleLogIfWatched(this, `stumped. sitting like a lump`);
  }

  private retireCreep(retiree: Creep): ScreepsReturnCode {
    // call for tug if no haul target set
    if (!this.memory.haulTarget) {
      this.callForTug(retiree.pos);
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

  protected abstract claimContainer(): ScreepsReturnCode;

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

  protected callForTug(target: RoomPosition): void {
    CreepUtils.consoleLogIfWatched(this, `calling for tug to: ${String(target)}`);
    this.memory.haulTarget = MemoryUtils.packRoomPosition(target);
    this.roomw.haulQueue.push(this.name);
  }
}
