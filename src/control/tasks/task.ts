import { TaskType } from "control/tasks/task-management";
import { MemoryUtils } from "planning/memory-utils";
import { CreepWrapper } from "roles/creep-wrapper";

export interface TaskInterface {
  type: TaskType;
  priority: number;
  pos: RoomPosition;
  override?: boolean;
  salt?: number;
  requirements?: (creep: Creep) => boolean;
  validate: () => boolean;
  cancel: () => void;
  complete: () => void;
  equals: (task: Task) => boolean;
}

export abstract class Task implements TaskInterface {
  public readonly type: TaskType;
  public readonly priority: number = 0;
  public readonly pos: RoomPosition;
  public readonly requirements?: ((creep: Creep) => boolean) | undefined;
  public readonly override?: boolean | undefined;
  public readonly salt?: number;

  public constructor(pos: RoomPosition, type: TaskType) {
    this.pos = pos;
    this.type = type;
  }

  public abstract validate(): boolean;
  public abstract work(creep: CreepWrapper): ScreepsReturnCode;
  public cancel(): void {
    // noop
  }
  public complete(): void {
    // noop
  }

  public toString(task?: Task): string {
    if (!task) {
      task = this;
    }
    return JSON.stringify(task, (key, value) => {
      if (key === "pos") {
        return MemoryUtils.packRoomPosition(value);
      } else {
        return JSON.stringify(value);
      }
    });
  }

  public equals(task: Task): boolean {
    let equals = true;
    equals = equals && this.type === task.type;
    equals = equals && this.priority === task.priority;
    equals = equals && this.pos.isEqualTo(task.pos);
    equals = equals && this.override === task.override;
    equals = equals && this.salt === task.salt;
    equals = equals && this.requirements === task.requirements;
    return equals;
  }
}
