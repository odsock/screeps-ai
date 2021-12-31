import { CreepUtils } from "creep-utils";
import { CreepWrapper } from "roles/creep-wrapper";
import { profile } from "../../screeps-typescript-profiler";

export enum TaskType {
  HAUL = "HAUL",
  SUPPLY = "SUPPLY",
  SUPPLY_SPAWN = "SUPPLY_SPAWN",
  UNLOAD = "UNLOAD",
  SUPPLY_CREEP = "SUPPLY_CREEP",
  CLEANUP = "CLEANUP"
}

export type Task = SupplyTask | HaulTask | SupplySpawnTask | UnloadTask | SupplyCreepTask | CleanupTask;

export interface SupplyTask {
  type: TaskType.SUPPLY;
  priority: number;
  pos: RoomPosition;
  targetId: Id<StructureWithStorage>;
  override?: boolean;
  resourceType: ResourceConstant;
  requirements?: (creep: Creep) => boolean;
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
  requirements?: (creep: Creep) => boolean;
}

export interface SupplyCreepTask {
  type: TaskType.SUPPLY_CREEP;
  priority: number;
  pos: RoomPosition;
  override?: boolean;
  requirements?: (creep: Creep) => boolean;
}

@profile
export class TaskManagement {
  /** assign tasks to creeps based on priority */
  public static assignTasks(haulers: CreepWrapper[], tasks: Task[]): void {
    const busyHaulers: CreepWrapper[] = [];
    const freeHaulers: CreepWrapper[] = [];
    haulers.forEach(h => {
      if (h.hasTask()) {
        busyHaulers.push(h);
      } else {
        freeHaulers.push(h);
      }
    });
    const newTasks = tasks.filter(t => !busyHaulers.some(h => this.isDuplicateTask(h.getTask(), t)));
    CreepUtils.consoleLogIfWatched(
      haulers[0].room,
      `${busyHaulers.length}/${freeHaulers.length} busy/free, found ${tasks.length} tasks, ${tasks.length} new tasks`
    );
    const tasksByPriority = newTasks.sort((a, b) => b.priority - a.priority);

    const unassignedTasks: Task[] = [];
    if (freeHaulers.length > 0) {
      tasksByPriority.forEach(task => {
        const acceptableHaulers = freeHaulers.filter(hauler => !task.requirements || task.requirements(hauler));
        if (acceptableHaulers.length > 0) {
          const closestHauler =
            task.pos.findClosestByPath(acceptableHaulers) ??
            task.pos.findClosestByRange(acceptableHaulers) ??
            acceptableHaulers[0];
          closestHauler.assignTask(task);
          freeHaulers.splice(
            freeHaulers.findIndex(h => h.id === closestHauler.id),
            1
          );
          busyHaulers.push(closestHauler);
        } else {
          CreepUtils.consoleLogIfWatched(haulers[0].room, `no acceptable haulers for task: ${task.type}`);
          unassignedTasks.push(task);
        }
      });
    } else {
      CreepUtils.consoleLogIfWatched(haulers[0].room, `no free haulers`);
    }

    // bump low priority tasks for higher priority tasks with override flag set
    const busyHaulersSorted = busyHaulers.sort((a, b) => (a.getTask()?.priority ?? 0) - (b.getTask()?.priority ?? 0));
    unassignedTasks.forEach(task => {
      if (task.override) {
        const haulersWithLowerPriorityTask = busyHaulersSorted.filter(
          h => (h.getTask()?.priority ?? 0) < task.priority
        );
        if (haulersWithLowerPriorityTask.length > 0) {
          const hauler = haulersWithLowerPriorityTask[0];
          const oldTask = hauler.getTask();
          CreepUtils.consoleLogIfWatched(
            hauler.room,
            `${hauler.name}: bumping ${String(oldTask?.type)} pri ${String(oldTask?.priority)} with ${task.type} pri ${
              task.priority
            }`
          );
          hauler.assignTask(task);
        }
      }
    });
  }

  private static isDuplicateTask(task: Task | undefined, t: Task): boolean {
    // HACK stringify to compare seems dumb
    return JSON.stringify(task) === JSON.stringify(t);
  }
}
