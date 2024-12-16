import { TaskType } from "control/tasks/task-management";
import { Task } from "./task";

export class SupplyStructureTask extends Task {
  public readonly priority: number;
  public readonly targetId: Id<StructureWithStorage>;
  public readonly resourceType: ResourceConstant;
  public readonly requirements?: (creep: Creep) => boolean;
  public readonly salt?: number;
  public readonly override?: boolean;

  public constructor({
    type,
    priority,
    pos,
    targetId,
    resourceType,
    requirements,
    salt,
    override
  }: {
    type?: TaskType;
    priority: number;
    pos: RoomPosition;
    targetId: Id<StructureWithStorage>;
    resourceType: ResourceConstant;
    requirements?: (creep: Creep) => boolean;
    salt?: number;
    override?: boolean;
  }) {
    super(pos, TaskType.SUPPLY_STRUCTURE);
    this.priority = priority;
    this.targetId = targetId;
    this.resourceType = resourceType;
    this.requirements = requirements;
    this.salt = salt;
    this.override = override;
  }

  public validate(): boolean {
    const target = Game.getObjectById(this.targetId);
    if (!target) {
      return false;
    }
    if (target.store.getFreeCapacity(this.resourceType) === 0) {
      return false;
    }
    return true;
  }
}
