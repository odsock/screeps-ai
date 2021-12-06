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
}

export interface UnloadTask {
  type: TaskType.UNLOAD;
  priority: number;
  pos: RoomPosition;
  targetId: Id<StructureContainer>;
  override?: boolean;
  resourceType: ResourceConstant;
}

export interface CleanupTask {
  type: TaskType.CLEANUP;
  priority: number;
  pos: RoomPosition;
  targetId: Id<Resource | Tombstone | Ruin>;
  override?: boolean;
}

export interface HaulTask {
  type: TaskType.HAUL;
  priority: number;
  pos: RoomPosition;
  creepName: string;
  targetId: Id<Creep>;
  override?: boolean;
}

export interface SupplySpawnTask {
  type: TaskType.SUPPLY_SPAWN;
  priority: number;
  pos: RoomPosition;
  override?: boolean;
}

export interface SupplyCreepTask {
  type: TaskType.SUPPLY_CREEP;
  priority: number;
  pos: RoomPosition;
  override?: boolean;
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
    CreepUtils.consoleLogIfWatched(haulers[0].room, `found ${tasks.length} tasks, ${tasks.length} new tasks`);
    const tasksByPriority = newTasks.sort((a, b) => b.priority - a.priority);

    const unassignedTasks: Task[] = [];
    if (freeHaulers.length > 0) {
      tasksByPriority.forEach(task => {
        const closestHauler =
          task.pos.findClosestByPath(freeHaulers) ?? task.pos.findClosestByRange(freeHaulers) ?? freeHaulers[0];
        console.log(`DEBUG: closest hauler: ${String(closestHauler?.name)}`);
        if (closestHauler) {
          closestHauler.assignTask(task);
          freeHaulers.splice(
            freeHaulers.findIndex(h => h.id === closestHauler.id),
            1
          );
          busyHaulers.push(closestHauler);
        } else {
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
