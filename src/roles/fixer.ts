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

  private doDismantleJob(): ScreepsReturnCode {
    if (this.memory.job !== "dismantle") {
      this.updateJob("dismantle");
    }
    const result: ScreepsReturnCode = this.dismantleStructures();
    CreepUtils.consoleLogResultIfWatched(this, `dismantle result`, result);
    return result;
  }
}
