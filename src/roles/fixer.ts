import { CreepUtils } from "creep-utils";
import { CreepRole } from "../population-control";
import { CreepWrapper } from "./creep-wrapper";

export class Fixer extends CreepWrapper {
  public static readonly ROLE = CreepRole.FIXER;
  // TODO fixer spawn should scale based on repairs to do?
  public static readonly BODY_PROFILE: CreepBodyProfile = {
    profile: [WORK, CARRY, MOVE, MOVE],
    seed: [],
    maxBodyParts: 16
  };

  public run(): void {
    this.touchRoad();

    let target = this.findStructureForRepair();
    if (target) {
      this.doRepairJob(target);
      return;
    }

    target = this.findDismantleTarget();
    if (target) {
      this.doDismantleJob(target);
    }
  }

  private doRepairJob(target: Structure): ScreepsReturnCode {
    this.updateJob("repairing");
    this.stopWorkingIfEmpty();
    this.startWorkingIfFull();
    this.startWorkingInRange(target.pos);

    if (this.memory.working) {
      const result = this.moveToAndRepair(target);
      CreepUtils.consoleLogIfWatched(this, `repair result`, result);
      return result;
    } else {
      this.harvestByPriority();
      return OK;
    }
  }

  private doDismantleJob(target: Structure): ScreepsReturnCode {
    this.updateJob("dismantle?");
    this.startWorkingInRange(target.pos, 1);
    this.startWorkingIfEmpty();
    this.stopWorkingIfFull();

    if (this.memory.working) {
      const result = this.moveToAndDismantle(target);
      CreepUtils.consoleLogIfWatched(this, `dismantle result`, result);
      return result;
    } else {
      const storage = this.findRoomStorage();
      if (storage) {
        const result = this.moveToAndTransfer(storage);
        return result;
      }
      return ERR_FULL;
    }
  }
}
