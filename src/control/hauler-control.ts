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
}

export interface HaulTask {
  type: TaskType.HAUL;
  priority: number;
  pos: RoomPosition;
  creepName: string;
}

export interface SupplySpawnTask {
  type: TaskType.SUPPLY_SPAWN;
  priority: number;
  pos: RoomPosition;
}

@profile
export class HaulerControl {
  public run(): void {
    for (const roomName in Game.rooms) {
      const roomw = RoomWrapper.getInstance(roomName);
      const haulers = roomw
        .find(FIND_MY_CREEPS, { filter: c => c.memory.role === Hauler.ROLE })
        .map(c => new Hauler(c));

      this.assignTasks(haulers, [
        ...this.createHaulTasks(roomw),
        ...this.createTowerSupplyTasks(roomw),
        ...this.createControllerSupplyTasks(roomw),
        ...this.createSupplySpawnTasks(roomw)
      ]);

      if (roomw.controller?.my && roomw.spawns.length > 0) {
        this.requestSpawns(roomw);
      }
    }
  }

  /** supply spawn/extensions if any capacity in room */
  private createSupplySpawnTasks(roomw: RoomWrapper): SupplySpawnTask[] {
    const tasks: SupplySpawnTask[] = [];
    if (roomw.energyAvailable === roomw.energyCapacityAvailable) {
      tasks.push({ type: TaskType.SUPPLY_SPAWN, priority: 250, pos: roomw.spawns[0].pos });
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
        return { type: TaskType.SUPPLY, target: c.id, pos: c.pos, priority: 150 };
      });
  }

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

    tasksByPriority.forEach(task => {
      const closestHauler = task.pos.findClosestByPath(freeHaulers);
      if (closestHauler) {
        closestHauler.memory.task = task;
        freeHaulers.splice(
          freeHaulers.findIndex(h => h.id === closestHauler.id),
          1
        );
      }
    });
  }

  private createHaulTasks(roomw: RoomWrapper): HaulTask[] {
    return roomw
      .find(FIND_MY_CREEPS, {
        filter: creep => creep.memory.haulRequested && !creep.memory.haulerName
      })
      .map(c => {
        return { type: TaskType.HAUL, creepName: c.name, pos: c.pos, priority: 100 };
      });
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
