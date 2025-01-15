import { TaskType } from "control/tasks/task-management";
import { CreepUtils } from "creep-utils";
import { Hauler } from "roles/hauler";
import { Task } from "./task";
import { CreepWrapper } from "roles/creep-wrapper";

export class CleanupTask extends Task {
  public readonly priority: number;
  public readonly targetId: Id<Resource | Tombstone | Ruin>;
  public readonly override?: boolean;
  public readonly requirements?: (creep: CreepWrapper) => boolean;
  public readonly target: Resource<ResourceConstant> | Tombstone | Ruin | null;

  public constructor({
    type,
    priority,
    pos,
    targetId,
    override,
    requirements
  }: {
    type?: TaskType;
    priority: number;
    pos: RoomPosition;
    targetId: Id<Resource | Tombstone | Ruin>;
    override?: boolean;
    requirements?: (creep: CreepWrapper) => boolean;
  }) {
    super(pos, TaskType.CLEANUP);
    this.priority = priority;
    this.targetId = targetId;
    this.override = override;
    this.requirements = requirements;
    this.target = Game.getObjectById(this.targetId);
  }

  public validate(): boolean {
    if (!this.target) {
      return false;
    }

    if (this.target instanceof Resource && this.target.amount === 0) {
      return false;
    } else if (
      (this.target instanceof Tombstone || this.target instanceof Ruin) &&
      this.target.store.getUsedCapacity() === 0
    ) {
      return false;
    }
    return true;
  }

  public work(creep: Hauler): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(creep, `cleanup drops/tombs/ruins`);
    let working = !!creep.memory.working;
    if (creep.isEmpty()) {
      working = true;
    }
    if (creep.isFull()) {
      working = false;
    }

    if (working) {
      CreepUtils.consoleLogIfWatched(creep, "working");
      let resourceType: ResourceConstant;
      if (!this.target) {
        return ERR_INVALID_TARGET;
      }
      if (!(this.target instanceof Resource)) {
        const resources = CreepUtils.getStoreContents(this.target.store);
        resourceType = resources[0];
      } else {
        resourceType = this.target.resourceType;
      }
      const result = creep.moveToAndGet(this.target, resourceType);
      if (result === OK) {
        return result;
      }
      CreepUtils.consoleLogIfWatched(creep, `cleanup`, result);
      return result;
    } else {
      const ret = creep.storeLoad();
      if (ret === OK) {
        creep.completeTask();
      }
      return ret;
    }
  }
}
