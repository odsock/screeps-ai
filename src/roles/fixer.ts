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
      this.repairStructures();

      // don't block the source while working
      const closestEnergySource = this.findClosestActiveEnergySource();
      if (closestEnergySource?.pos && this.pos.isNearTo(closestEnergySource)) {
        const path = PathFinder.search(this.pos, { pos: closestEnergySource.pos, range: 2 }, { flee: true });
        this.moveByPath(path.path);
      }
    } else {
      this.harvestByPriority();
    }
  }
}
