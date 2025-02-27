import { TaskType } from "control/tasks/task-management";
import { Task } from "./task";
import { CreepUtils } from "creep-utils";
import { CreepWrapper } from "roles/creep-wrapper";

import { profile } from "../../../screeps-typescript-profiler";

@profile
export class UnloadTask extends Task {
  public readonly targetId: Id<StructureContainer>;
  public readonly resourceType: ResourceConstant;
  public readonly priority: number;
  public readonly override?: boolean = false;
  public readonly requirements?: (creep: CreepWrapper) => boolean;

  public readonly target?: StructureContainer | null;

  public constructor({
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    type,
    targetId,
    resourceType,
    pos,
    priority,
    override,
    requirements
  }: {
    type?: TaskType;
    targetId: Id<StructureContainer>;
    resourceType: ResourceConstant;
    pos: RoomPosition;
    priority: number;
    override?: boolean;
    requirements?: (creep: CreepWrapper) => boolean;
  }) {
    super(pos, TaskType.UNLOAD);
    this.targetId = targetId;
    this.resourceType = resourceType;
    this.priority = priority;
    this.override = override;
    this.requirements = requirements;
    this.target = Game.getObjectById(this.targetId);
  }

  public validate(): boolean {
    if (!this.target || this.target.store.getUsedCapacity(this.resourceType) === 0) {
      return false;
    }
    return true;
  }

  public work(creep: CreepWrapper): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(creep, `unload task`);
    let working = !!creep.memory.working;
    if (creep.isEmpty()) {
      working = true;
    }
    if (creep.isFull()) {
      working = false;
    }

    if (working) {
      CreepUtils.consoleLogIfWatched(creep, "working");
      const result = creep.moveToAndGet(this.target, this.resourceType);
      CreepUtils.consoleLogIfWatched(creep, `unload ${String(this.target)}`, result);
      if (result === OK) {
        creep.memory.working = false;
      }
      return result;
    } else {
      CreepUtils.consoleLogIfWatched(creep, `dumping`);
      const storage = creep.findRoomStorage();
      if (storage) {
        const resourcesHeld = creep.getStoreContents();
        const result = creep.moveToAndTransfer(storage, resourcesHeld[0]);
        CreepUtils.consoleLogIfWatched(creep, `dump at ${String(storage)}`, result);
        if (result === OK) {
          creep.completeTask();
        }
        return result;
      }
      return ERR_FULL;
    }
  }
}
