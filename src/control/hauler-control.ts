import { CreepUtils } from "creep-utils";
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
}

@profile
export class HaulerControl {
  public run(): void {
    for (const roomName in Game.rooms) {
      const roomw = RoomWrapper.getInstance(roomName);
      const haulers = roomw
        .find(FIND_MY_CREEPS, { filter: c => c.memory.role === Hauler.ROLE })
        .map(c => new Hauler(c));

      // find creeps requesting hauling
      const creepsToHaul = this.findHaulRequesters(roomw);
      // assign to empty hauler with no other task
      const emptyHaulers = haulers.filter(h => h.store.getUsedCapacity() === 0 && !h.memory.hauleeName);
      creepsToHaul.forEach(c => {
        const closestHauler = c.pos.findClosestByPath(emptyHaulers);
        if (closestHauler) {
          closestHauler.memory.task = { type: TaskType.HAUL, target: c.name };
          closestHauler.memory.hauleeName = c.name;
          c.memory.haulerName = closestHauler.name;
          emptyHaulers.splice(emptyHaulers.findIndex(h => h.id === closestHauler.id));
        }
      });

      if (roomw.controller?.my && roomw.spawns.length > 0) {
        this.requestSpawns(roomw);
      }
    }
  }

  private findHaulRequesters(roomw: RoomWrapper): Creep[] {
    return roomw.find(FIND_MY_CREEPS, {
      filter: creep => creep.memory.haulRequested && !creep.memory.haulerName
    });
  }

  private requestSpawns(roomw: RoomWrapper) {
    const spawnQueue = roomw.memory.spawnQueue ?? [];

    const haulerCount = SpawnUtils.getCreepCountForRole(roomw, Hauler.ROLE);

    // FIRST HAULER
    // always need at least one hauler to fill spawns and move harvesters
    if (haulerCount === 0) {
      spawnQueue.push({
        bodyProfile: Hauler.BODY_PROFILE,
        role: Hauler.ROLE,
        priority: 110
      });
    }

    // BACKUP HAULER
    // spawn with max body
    // TODO this will double spawn haulers when all are old
    const youngHaulers = roomw.find(FIND_MY_CREEPS, {
      filter: c => c.memory.role === Hauler.ROLE && c.ticksToLive && c.ticksToLive > 1000
    });
    CreepUtils.consoleLogIfWatched(roomw, `haulers: ${youngHaulers.length} younger than 1000`);
    if (youngHaulers.length === 0 && haulerCount <= roomw.sources.length + 1) {
      spawnQueue.push({
        bodyProfile: Hauler.BODY_PROFILE,
        max: true,
        role: Hauler.ROLE,
        priority: 109
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
        role: Hauler.ROLE,
        priority: 70
      });
    }

    roomw.memory.spawnQueue = spawnQueue;
  }
}
