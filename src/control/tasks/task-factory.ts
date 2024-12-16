import { TaskType } from "control/tasks/task-management";
import { Task } from "./task";
import { CleanupTask } from "./cleanup-task";
import { HaulTask } from "./haul-task";
import { SupplyStructureTask } from "./supply-structure-task";
import { SupplySpawnTask } from "./supply-spawn-task";
import { UnloadTask } from "./unload-task";
import { SupplyCreepTask } from "./supply-creep-task";

export class TaskFactory {
  public static create(task: Task): Task {
    switch (task.type) {
      case TaskType.CLEANUP:
        return new CleanupTask(task as CleanupTask);
      case TaskType.HAUL:
        return new HaulTask(task as HaulTask);
      case TaskType.SUPPLY_STRUCTURE:
        return new SupplyStructureTask(task as SupplyStructureTask);
      case TaskType.SUPPLY_SPAWN:
        return new SupplySpawnTask(task as SupplySpawnTask);
      case TaskType.UNLOAD:
        return new UnloadTask(task as UnloadTask);
      case TaskType.SUPPLY_CREEP:
        return new SupplyCreepTask(task as SupplyCreepTask);

      default:
        assertNever(task.type);
    }

    function assertNever(x: never): never {
      throw new Error("Missing task handler: " + JSON.stringify(x));
    }
  }
}
