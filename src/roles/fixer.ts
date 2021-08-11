import { CreepUtils } from "creep-utils";
import { CreepWrapper } from "./creep-wrapper";

export class Fixer extends CreepWrapper {
  public run(): void {
    this.touchRoad();
    this.doRepairJob();
  }

  private doRepairJob(): void {
    this.updateJob("repairing");
    this.stopWorkingIfEmpty();
    this.startWorkingIfFull("🚧 repair");

    if (this.memory.working) {
      const result = this.repairStructures();
      CreepUtils.consoleLogResultIfWatched(this, `repair result`, result);
    } else {
      this.harvestByPriority();
    }
  }
}
