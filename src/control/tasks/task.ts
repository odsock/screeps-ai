import { TaskType } from "control/tasks/task-management";

export interface TaskInterface {
  pos: RoomPosition;
  requirements?: (creep: Creep) => boolean;
  override?: boolean;
  type: TaskType;
  priority: number;
  validate: () => boolean;
  cancel: () => void;
  complete: () => void;
}

// export type Task = SupplyTask | HaulTask | SupplySpawnTask | UnloadTask | SupplyCreepTask | CleanupTask;

export interface SupplyTask {
  type: TaskType.SUPPLY_STRUCTURE;
  priority: number;
  pos: RoomPosition;
  targetId: Id<StructureWithStorage>;
  override?: boolean;
  resourceType: ResourceConstant;
  requirements?: (creep: Creep) => boolean;
  salt?: number;
}

export interface UnloadTask {
  type: TaskType.UNLOAD;
  priority: number;
  pos: RoomPosition;
  targetId: Id<StructureContainer>;
  override?: boolean;
  resourceType: ResourceConstant;
  requirements?: (creep: Creep) => boolean;
}

export interface CleanupTask {
  type: TaskType.CLEANUP;
  priority: number;
  pos: RoomPosition;
  targetId: Id<Resource | Tombstone | Ruin>;
  override?: boolean;
  requirements?: (creep: Creep) => boolean;
}

export interface HaulTask {
  type: TaskType.HAUL;
  priority: number;
  pos: RoomPosition;
  creepName: string;
  targetId: Id<Creep>;
  override?: boolean;
  requirements?: (creep: Creep) => boolean;
}

export interface SupplySpawnTask {
  type: TaskType.SUPPLY_SPAWN;
  priority: number;
  pos: RoomPosition;
  override?: boolean;
  salt?: number;
  requirements?: (creep: Creep) => boolean;
}

export interface SupplyCreepTask {
  type: TaskType.SUPPLY_CREEP;
  priority: number;
  pos: RoomPosition;
  override?: boolean;
  requirements?: (creep: Creep) => boolean;
}

export abstract class Task implements TaskInterface {
  public readonly type: TaskType;
  public readonly priority: number = 0;
  public readonly pos: RoomPosition;
  public readonly requirements?: ((creep: Creep) => boolean) | undefined;
  public readonly override?: boolean | undefined;

  public constructor(pos: RoomPosition, type: TaskType) {
    this.pos = pos;
    this.type = type;
  }

  public abstract validate(): boolean;
  public cancel(): void {
    // noop
  }
  public complete(): void {
    // noop
  }
}
