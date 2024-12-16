import { TaskType } from "control/tasks/task-management";
import { Task } from "./task";

export class CleanupTask extends Task {
  public readonly priority: number;
  public readonly targetId: Id<Resource | Tombstone | Ruin>;
  public readonly override?: boolean;
  public readonly requirements?: (creep: Creep) => boolean;

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
    requirements?: (creep: Creep) => boolean;
  }) {
    super(pos, TaskType.CLEANUP);
    this.priority = priority;
    this.targetId = targetId;
    this.override = override;
    this.requirements = requirements;
  }

  public validate(): boolean {
    const target = Game.getObjectById(this.targetId);
    if (!target) {
      return false;
    }

    if (target instanceof Resource && target.amount === 0) {
      return false;
    } else if ((target instanceof Tombstone || target instanceof Ruin) && target.store.getUsedCapacity() === 0) {
      return false;
    }
    return true;
  }
}
