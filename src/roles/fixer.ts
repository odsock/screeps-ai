import { CreepUtils } from "creep-utils";
import { CreepWrapper } from "./creep-wrapper";

export class Fixer extends CreepWrapper {
  public run(): void {
    this.touchRoad();
    const result = this.doDismantleJob();
    if (result === ERR_NOT_FOUND) {
      this.doRepairJob();
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
}
