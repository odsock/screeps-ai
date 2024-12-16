import { TaskType } from "control/tasks/task-management";
import { Task } from "./task";

export class HaulTask extends Task {
  public readonly priority: number;
  public readonly creepName: string;
  public readonly targetId: Id<Creep>;
  public readonly override?: boolean;
  public readonly requirements?: (creep: Creep) => boolean;

  private creepToHaul: Creep;

  public constructor({
    type,
    priority,
    pos,
    creepName,
    targetId,
    override,
    requirements
  }: {
    type?: TaskType;
    priority: number;
    pos: RoomPosition;
    creepName: string;
    targetId: Id<Creep>;
    override?: boolean;
    requirements?: (creep: Creep) => boolean;
  }) {
    super(pos, TaskType.HAUL);
    this.priority = priority;
    this.creepName = creepName;
    this.targetId = targetId;
    this.override = override;
    this.requirements = requirements;
    this.creepToHaul = Game.creeps[this.creepName];
  }

  public validate(): boolean {
    if (!this.creepToHaul) {
      return false;
    }
    return !!this.creepToHaul.memory.haulRequested;
  }

  public cancel(): void {
    if (this.creepToHaul) {
      this.creepToHaul.memory.haulRequested = false;
      this.creepToHaul.memory.haulerName = undefined;
    }
  }

  public complete(): void {
    // noop
  }
}
