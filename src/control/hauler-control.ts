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
export class HaulerControl {
  public run(): void {
    for (const roomName in Game.rooms) {
      const roomw = RoomWrapper.getInstance(roomName);
      const haulers = _.filter(Game.creeps, c => c.memory.role === Hauler.ROLE && c.memory.homeRoom === roomName).map(
        c => new Hauler(c)
      );

      if (haulers.length > 0) {
        this.assignTasks(haulers, [
          ...this.createHaulTasks(roomw),
          ...this.createTowerSupplyTasks(roomw),
          ...this.createControllerSupplyTasks(roomw),
          ...this.createSupplySpawnTasks(roomw),
          ...this.createUnloadTasks(roomw),
          ...this.createSupplyCreepTasks(roomw),
          ...this.createCleanupTasks(roomw)
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

  private isDuplicateTask(task: Task | undefined, t: Task): boolean {
    // HACK stringify to compare seems dumb
    return JSON.stringify(task) === JSON.stringify(t);
  }

  /** clean up drops, tombs, ruins */
  private createCleanupTasks(roomw: RoomWrapper): CleanupTask[] {
    const tasks: CleanupTask[] = [];
    roomw
      .find(FIND_DROPPED_RESOURCES)
      .forEach(d => tasks.push({ type: TaskType.CLEANUP, pos: d.pos, targetId: d.id, priority: 100 }));
    roomw
      .find(FIND_TOMBSTONES, { filter: t => t.store.getUsedCapacity() > 0 })
      .forEach(t => tasks.push({ type: TaskType.CLEANUP, pos: t.pos, targetId: t.id, priority: 100 }));
    roomw
      .find(FIND_RUINS, { filter: r => r.store.getUsedCapacity() > 0 })
      .forEach(r => tasks.push({ type: TaskType.CLEANUP, pos: r.pos, targetId: r.id, priority: 100 }));
    return tasks;
  }

  /** supply builders, upgraders */
  // TODO cache id's to avoid double find in Hauler
  private createSupplyCreepTasks(roomw: RoomWrapper): SupplyCreepTask[] {
    const tasks: SupplyCreepTask[] = [];
    const creeps = roomw.creeps.filter(
      c => [CreepRole.BUILDER, CreepRole.UPGRADER].includes(c.memory.role) && c.store.energy === 0
    );
    if (creeps.length > 0) {
      const pos = CreepUtils.averagePos(creeps);
      tasks.push({ type: TaskType.SUPPLY_CREEP, priority: 90, pos });
    }
    return tasks;
  }

  /** unload source containers over threshold */
  private createUnloadTasks(roomw: RoomWrapper): UnloadTask[] {
    return roomw.sourceContainers
      .filter(c => c.store.getFreeCapacity() < c.store.getCapacity() / 4)
      .map(c => {
        return {
          type: TaskType.UNLOAD,
          priority: 200,
          targetId: c.id,
          pos: c.pos
        };
      });
  }

  /** supply spawn/extensions if any capacity in room */
  private createSupplySpawnTasks(roomw: RoomWrapper): SupplySpawnTask[] {
    const spawns = roomw.spawns;
    const tasks: SupplySpawnTask[] = [];
    if (spawns.length > 0 && roomw.energyAvailable < roomw.energyCapacityAvailable) {
      tasks.push({ type: TaskType.SUPPLY_SPAWN, priority: 240, pos: spawns[0].pos, override: true });
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
        return { type: TaskType.SUPPLY, targetId: t.id, pos: t.pos, priority: 250, resourceType: RESOURCE_ENERGY };
      });
  }

  /** supply controller container if have upgraders */
  private createControllerSupplyTasks(roomw: RoomWrapper): Task[] {
    const upgraders = roomw.creeps.filter(c => c.memory.role === CreepRole.UPGRADER);
    if (upgraders.length === 0) {
      return [];
    }
    return roomw.controllerContainers
      .filter(container => container.store.getUsedCapacity() < container.store.getCapacity() / 4)
      .map(c => {
        return { type: TaskType.SUPPLY, targetId: c.id, pos: c.pos, priority: 100, resourceType: RESOURCE_ENERGY };
      });
  }

  private createHaulTasks(roomw: RoomWrapper): HaulTask[] {
    const creeps = roomw.find(FIND_MY_CREEPS, {
      filter: creep => creep.memory.haulRequested && !creep.memory.haulerName
    });
    const upgraderTasks: HaulTask[] = creeps
      .filter(c => c.memory.role === CreepRole.UPGRADER)
      .map(c => {
        return { type: TaskType.HAUL, creepName: c.name, targetId: c.id, pos: c.pos, priority: 150 };
      });
    const priority = roomw.storage?.store.energy ?? -1 > 0 ? 150 : 300;
    const harvesterTasks: HaulTask[] = creeps
      .filter(c => c.memory.role === CreepRole.HARVESTER)
      .map(c => {
        return { type: TaskType.HAUL, creepName: c.name, targetId: c.id, pos: c.pos, priority, override: true };
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
