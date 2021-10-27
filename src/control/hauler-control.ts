import { CreepUtils } from "creep-utils";
import { SpawnQueue } from "planning/spawn-queue";
import { Hauler } from "roles/hauler";
import { RoomWrapper } from "structures/room-wrapper";
import { profile } from "../../screeps-typescript-profiler";
import { SpawnUtils } from "./spawn-utils";

export enum TaskType {
  HAUL = "haul"
}

export interface Task {
  type: TaskType;
  target: string;
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

      const haulTasks = this.createHaulTasks(roomw);
      this.assignTasks(haulers, haulTasks);

      if (roomw.controller?.my && roomw.spawns.length > 0) {
        this.requestSpawns(roomw);
      }
    }
  }

  private assignTasks(haulers: Hauler[], haulTasks: Task[]): void {
    const freeHaulers = haulers.filter(h => !h.memory.task);

    haulTasks.forEach(task => {
      const closestHauler = task.pos.findClosestByPath(freeHaulers);
      if (closestHauler) {
        closestHauler.memory.task = task;
        freeHaulers.splice(freeHaulers.findIndex(h => h.id === closestHauler.id));
      }
    });
  }

  private createHaulTasks(roomw: RoomWrapper): Task[] {
    return roomw
      .find(FIND_MY_CREEPS, {
        filter: creep => creep.memory.haulRequested && !creep.memory.haulerName
      })
      .map(c => {
        return { type: TaskType.HAUL, target: c.name, pos: c.pos, priority: 100 };
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
