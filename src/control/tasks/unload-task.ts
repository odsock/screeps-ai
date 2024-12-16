import { TaskType } from "control/tasks/task-management";
import { Task } from "./task";

export class UnloadTask extends Task {
  public readonly targetId: Id<StructureContainer>;
  public readonly resourceType: ResourceConstant;
  public readonly priority: number;
  public readonly override?: boolean = false;
  public readonly requirements?: (creep: Creep) => boolean;

  public readonly target?: StructureContainer | null;

  public constructor({
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
    requirements?: (creep: Creep) => boolean;
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
}
