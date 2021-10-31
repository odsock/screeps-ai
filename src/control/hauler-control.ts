import { CreepRole } from "config/creep-types";
import { SockPuppetConstants } from "config/sockpuppet-constants";
import { CreepUtils } from "creep-utils";
import { SpawnQueue } from "planning/spawn-queue";
import { Hauler } from "roles/hauler";
import { RoomWrapper } from "structures/room-wrapper";
import { profile } from "../../screeps-typescript-profiler";
import { SpawnUtils } from "./spawn-utils";

export enum TaskType {
  HAUL = "HAUL",
  SUPPLY = "SUPPLY",
  SUPPLY_SPAWN = "SUPPLY_SPAWN"
}

export type Task = SupplyTask | HaulTask | SupplySpawnTask;

export interface SupplyTask {
  type: TaskType.SUPPLY;
  priority: number;
  pos: RoomPosition;
  target: string;
  override?: boolean;
}

export interface HaulTask {
  type: TaskType.HAUL;
  priority: number;
  pos: RoomPosition;
  creepName: string;
  override?: boolean;
}

export interface SupplySpawnTask {
  type: TaskType.SUPPLY_SPAWN;
  priority: number;
  pos: RoomPosition;
  override?: boolean;
}

@profile
export class HaulerControl {
  public run(): void {
    for (const roomName in Game.rooms) {
      const roomw = RoomWrapper.getInstance(roomName);
      const haulers = roomw
        .find(FIND_MY_CREEPS, { filter: c => c.memory.role === Hauler.ROLE })
        .map(c => new Hauler(c));

      if (haulers.length > 0) {
        this.assignTasks(haulers, [
          ...this.createHaulTasks(roomw),
          ...this.createTowerSupplyTasks(roomw),
          ...this.createControllerSupplyTasks(roomw),
          ...this.createSupplySpawnTasks(roomw)
        ]);
      }

      if (roomw.controller?.my && roomw.spawns.length > 0) {
        this.requestSpawns(roomw);
      }
    }
  }

  /** assign tasks to creeps based on priority */
  private assignTasks(haulers: Hauler[], tasks: Task[]): void {
    const busyHaulers: Hauler[] = [];
    const freeHaulers: Hauler[] = [];
    haulers.forEach(h => {
      if (h.memory.task) {
        busyHaulers.push(h);
      } else {
        freeHaulers.push(h);
      }
    });
    const newTasks = tasks.filter(t => !busyHaulers.some(h => _.isEqual(h.memory.task, t)));
    const tasksByPriority = newTasks.sort((a, b) => b.priority - a.priority);

    const unassignedTasks: Task[] = [];
    tasksByPriority.forEach(task => {
      const closestHauler = task.pos.findClosestByPath(freeHaulers);
      if (closestHauler) {
        closestHauler.memory.task = task;
        freeHaulers.splice(
          freeHaulers.findIndex(h => h.id === closestHauler.id),
          1
        );
        busyHaulers.push(closestHauler);
      } else {
        unassignedTasks.push(task);
      }
    });

    // bump low priority tasks for higher priority tasks with override flag set
    const busyHaulersSorted = busyHaulers.sort(
      (a, b) => (a.memory.task?.priority ?? 0) - (b.memory.task?.priority ?? 0)
    );
    unassignedTasks.forEach(task => {
      if (task.override) {
        const haulersWithLowerPriorityTask = busyHaulersSorted.filter(
          h => h.memory.task?.priority ?? 0 < task.priority
        );
        console.log(
          `DEBUG: ${JSON.stringify(task)}, ${JSON.stringify(haulersWithLowerPriorityTask.map(h => h.memory.task))}`
        );
        if (haulersWithLowerPriorityTask.length > 0) {
          const hauler = haulersWithLowerPriorityTask[0];
          const oldTask = hauler.memory.task;
          CreepUtils.consoleLogIfWatched(
            hauler.room,
            `${hauler.name}: bumping ${String(oldTask?.type)} pri ${String(oldTask?.priority)} with ${task.type} pri ${
              task.priority
            }`
          );
          hauler.memory.task = task;
        }
      }
    });
  }

  /** supply spawn/extensions if any capacity in room */
  private createSupplySpawnTasks(roomw: RoomWrapper): SupplySpawnTask[] {
    const spawns = roomw.spawns;
    const tasks: SupplySpawnTask[] = [];
    if (spawns.length > 0 && roomw.energyAvailable <= roomw.energyCapacityAvailable) {
      tasks.push({ type: TaskType.SUPPLY_SPAWN, priority: 250, pos: spawns[0].pos, override: true });
    }
    return tasks;
  }

  /** supply towers */
  private createTowerSupplyTasks(roomw: RoomWrapper): Task[] {
    return roomw.towers
      .filter(
        tower =>
          tower.store.getFreeCapacity(RESOURCE_ENERGY) > 0 &&
          CreepUtils.getEnergyStoreRatioFree(tower) > SockPuppetConstants.TOWER_RESUPPLY_THRESHOLD
      )
      .map(t => {
        return { type: TaskType.SUPPLY, target: t.id, pos: t.pos, priority: 200 };
      });
  }

  /** supply controller container */
  private createControllerSupplyTasks(roomw: RoomWrapper): Task[] {
    return roomw.controllerContainers
      .filter(container => container.store.getFreeCapacity() > 0)
      .map(c => {
        return { type: TaskType.SUPPLY, target: c.id, pos: c.pos, priority: 100 };
      });
  }

  private createHaulTasks(roomw: RoomWrapper): HaulTask[] {
    const creeps = roomw.find(FIND_MY_CREEPS, {
      filter: creep => creep.memory.haulRequested && !creep.memory.haulerName
    });
    const upgraderTasks: HaulTask[] = creeps
      .filter(c => c.memory.role === CreepRole.UPGRADER)
      .map(c => {
        return { type: TaskType.HAUL, creepName: c.name, pos: c.pos, priority: 150 };
      });
    const priority = roomw.storage?.store.energy ?? -1 > 0 ? 150 : 300;
    const harvesterTasks: HaulTask[] = creeps
      .filter(c => c.memory.role === CreepRole.HARVESTER)
      .map(c => {
        return { type: TaskType.HAUL, creepName: c.name, pos: c.pos, priority, override: true };
      });
    return [...upgraderTasks, ...harvesterTasks];
  }

  private requestSpawns(roomw: RoomWrapper): void {
    const spawnQueue = SpawnQueue.getInstance(roomw);

    const haulerCount = SpawnUtils.getCreepCountForRole(roomw, Hauler.ROLE);

    // FIRST HAULER
    // always need at least one hauler to fill spawns and move harvesters
    if (haulerCount === 0) {
      spawnQueue.push({
        bodyProfile: Hauler.BODY_PROFILE,
        memory: { role: Hauler.ROLE },
        priority: 110
      });
    }

    // HAULER
    // spawn enough haulers to keep up with hauling needed
    const sourcesPlusOne = roomw.sources.length + 1;
    CreepUtils.consoleLogIfWatched(roomw, `haulers: ${haulerCount}/${sourcesPlusOne}`);
    if (haulerCount < sourcesPlusOne) {
      spawnQueue.push({
        bodyProfile: Hauler.BODY_PROFILE,
        max: true,
        memory: { role: Hauler.ROLE },
        priority: 85
      });
    }

    if (haulerCount <= sourcesPlusOne) {
      SpawnUtils.requestReplacementCreep(roomw, Hauler);
    }
  }
}
