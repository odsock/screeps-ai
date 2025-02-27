import { CreepRole } from "config/creep-types";
import { CreepUtils } from "creep-utils";
import { CreepWrapper } from "./creep-wrapper";
import { CreepBodyProfile } from "./creep-body-utils";

import { profile } from "../../screeps-typescript-profiler";

@profile
export class Fixer extends CreepWrapper {
  public static readonly ROLE = CreepRole.FIXER;
  public static readonly BODY_PROFILE: CreepBodyProfile = {
    profile: [WORK, CARRY, MOVE, MOVE],
    seed: [],
    maxBodyParts: 16
  };

  public run(): void {
    let repairTarget: Structure | undefined;
    if (this.memory.lastTargetId) {
      repairTarget = Game.getObjectById(this.memory.lastTargetId) ?? undefined;
    }
    if (!repairTarget || repairTarget.hits === repairTarget.hitsMax) {
      repairTarget = this.findStructureForRepair();
      this.memory.lastTargetId = repairTarget?.id;
    }
    if (repairTarget) {
      this.doRepairJob(repairTarget);
      return;
    }

    const dismantleTarget = this.findDismantleTarget();
    if (dismantleTarget) {
      this.doDismantleJob(dismantleTarget);
      return;
    }

    this.moveOffTheRoad();
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
      // clear cached repair target when not working
      delete this.memory.lastTargetId;
      this.harvestByPriority();
      return OK;
    }
  }
}
