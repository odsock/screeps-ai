import { CreepUtils } from "creep-utils";
import { CreepWrapper } from "roles/creep-wrapper";
import { Task } from "./task";

export enum TaskType {
  HAUL = "HAUL",
  SUPPLY_STRUCTURE = "SUPPLY_STRUCTURE",
  SUPPLY_SPAWN = "SUPPLY_SPAWN",
  UNLOAD = "UNLOAD",
  SUPPLY_CREEP = "SUPPLY_CREEP",
  CLEANUP = "CLEANUP"
}

import { profile } from "../../../screeps-typescript-profiler";

@profile
export class TaskManagement {
  /** assign tasks to creeps based on priority */
  public static assignTasks(haulers: CreepWrapper[], tasks: Task[]): void {
    // split haulers into busy and free lists
    const busyHaulers: CreepWrapper[] = [];
    const freeHaulers: CreepWrapper[] = [];
    haulers.forEach(h => {
      if (h.hasTask()) {
        busyHaulers.push(h);
      } else {
        freeHaulers.push(h);
      }
    });

    // drop repeated requests already assigned to a hauler in a previous tick and sort by priority
    const tasksByPriority = tasks
      .filter(t => !busyHaulers.some(h => h.getTask()?.equals(t)))
      .sort((a, b) => b.priority - a.priority);

    // try to assign tasks to free haulers
    let unassignedTasks: Task[] = [];
    if (freeHaulers.length > 0) {
      unassignedTasks = TaskManagement.assignUnassignedTasks(
        tasksByPriority,
        freeHaulers,
        busyHaulers,
        haulers[0].room
      );
    } else {
      CreepUtils.consoleLogIfWatched(haulers[0].room, `no free haulers`);
    }

    // bump low priority tasks for higher priority tasks with override flag set
    TaskManagement.bumpTasksForOverrideFlags(busyHaulers, unassignedTasks);

    TaskManagement.printTaskSummary(haulers, tasks, tasksByPriority, busyHaulers, freeHaulers);
  }

  private static bumpTasksForOverrideFlags(busyHaulers: CreepWrapper[], unassignedTasks: Task[]) {
    const busyHaulersSorted = busyHaulers.sort((a, b) => (a.getTask()?.priority ?? 0) - (b.getTask()?.priority ?? 0));
    unassignedTasks
      .filter(task => task.override)
      .forEach(task => {
        CreepUtils.consoleLogIfWatched(busyHaulers[0].room, `override task: ${task.toString()}`);
        const haulerToBump = busyHaulersSorted.find(h => (h.getTask()?.priority ?? 0) <= task.priority);
        if (haulerToBump) {
          const oldTask = haulerToBump.getTask();
          CreepUtils.consoleLogIfWatched(
            haulerToBump.room,
            `${haulerToBump.name}: bumping ${String(oldTask?.type)} pri ${String(oldTask?.priority)} with ${
              task.type
            } pri ${task.priority}`
          );
          haulerToBump.assignTask(task);
        }
      });
  }

  private static assignUnassignedTasks(
    tasksByPriority: Task[],
    freeHaulers: CreepWrapper[],
    busyHaulers: CreepWrapper[],
    room: Room
  ): Task[] {
    if (freeHaulers.length === 0) {
      return tasksByPriority;
    }
    const unassignedTasks: Task[] = [];
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
        CreepUtils.consoleLogIfWatched(room, `no acceptable haulers for task: ${task.type}`);
        unassignedTasks.push(task);
      }
    });
    return unassignedTasks;
  }

  private static printTaskSummary(
    haulers: CreepWrapper[],
    tasks: Task[],
    tasksByPriority: Task[],
    busyHaulers: CreepWrapper[],
    freeHaulers: CreepWrapper[]
  ) {
    CreepUtils.consoleLogIfWatched(
      haulers[0].room,
      `tasks requested (${tasks.length}): ${tasks
        .map(task => task.type + ":" + String(task.priority) + ":" + String(task.pos.x) + "," + String(task.pos.y))
        .join(", ")}`
    );
    CreepUtils.consoleLogIfWatched(
      haulers[0].room,
      `tasks to assign (${tasksByPriority.length}): ${tasksByPriority
        .map(task => task.type + ":" + String(task.priority) + ":" + String(task.pos.x) + "," + String(task.pos.y))
        .join(", ")}`
    );
    const tasksBeingWorked = haulers
      .map(h => `${h.name}:${h.memory.task?.type ?? ""}:${h.memory.task?.priority ?? ""}`)
      .join(", ");
    CreepUtils.consoleLogIfWatched(haulers[0].room, `tasks assigned: ${tasksBeingWorked}`);
    CreepUtils.consoleLogIfWatched(haulers[0].room, `${busyHaulers.length}/${freeHaulers.length} busy/free`);
  }
}
