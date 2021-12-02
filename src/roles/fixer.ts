import { CreepRole } from "config/creep-types";
import { CreepUtils } from "creep-utils";
import { CreepBodyProfile, CreepWrapper } from "./creep-wrapper";
import { profile } from "../../screeps-typescript-profiler";
import { CostMatrixUtils } from "utils/cost-matrix-utils";

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

    if (this.pos.lookFor(LOOK_STRUCTURES).some(item => item.structureType === STRUCTURE_ROAD)) {
      return this.moveOffTheRoad();
    }
  }

  private moveOffTheRoad(): void {
    const path = PathFinder.search(
      this.pos,
      { pos: this.pos, range: 20 },
      {
        flee: true,
        plainCost: 0,
        swampCost: 10,
        roomCallback: CostMatrixUtils.creepMovementRoomCallback
      }
    );
    const result = this.moveByPath(path.path);
    CreepUtils.consoleLogIfWatched(this, `moving off the road`, result);
    return;
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
