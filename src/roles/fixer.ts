import { CreepUtils } from "creep-utils";
import { CreepWrapper } from "./creep-wrapper";

export class Fixer extends CreepWrapper {
  public run(): void {
    this.touchRoad();
    const result = this.doRepairJob();
    if (result === ERR_NOT_FOUND) {
      this.doDismantleJob();
    }
  }

  private doRepairJob(): ScreepsReturnCode {
    this.updateJob("repairing");
    this.stopWorkingIfEmpty();
    this.startWorkingIfFull("🚧 repair");

    if (this.memory.working) {
      const result = this.repairStructures();
      CreepUtils.consoleLogResultIfWatched(this, `repair result`, result);
      return result;
    } else {
      this.harvestByPriority();
      return OK;
    }
  }

  private doDismantleJob(): ScreepsReturnCode {
    this.updateJob("dismantle");

    if (this.memory.working) {
      const result: ScreepsReturnCode = this.dismantleStructures();
      CreepUtils.consoleLogResultIfWatched(this, `dismantle result`, result);
      return result;
    }
    return OK;
  }
}
