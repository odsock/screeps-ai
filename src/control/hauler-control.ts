import { CreepUtils } from "creep-utils";
import { Hauler } from "roles/hauler";
import { RoomWrapper } from "structures/room-wrapper";
import { profile } from "../../screeps-typescript-profiler";

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
      const haulers = roomw.find(FIND_MY_CREEPS, { filter: c => c.memory.role === "hauler" }).map(c => new Hauler(c));

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

      if (roomw.controller?.my) {
        this.requestHaulerSpawns(roomw, haulers);
      }
    }
  }

  private findHaulRequesters(roomw: RoomWrapper): Creep[] {
    return roomw.find(FIND_MY_CREEPS, {
      filter: creep => creep.memory.haulRequested && !creep.memory.haulerName
    });
  }

  private requestHaulerSpawns(roomw: RoomWrapper, haulers: Hauler[]) {
    const spawnQueue = roomw.memory.spawnQueue ?? [];

    // FIRST HAULER
    // always need at least one hauler to fill spawns and move harvesters
    if (haulers.length === 0) {
      spawnQueue.push({
        bodyProfile: Hauler.BODY_PROFILE,
        role: Hauler.ROLE,
        priority: 110
      });
    }

    // BACKUP HAULER
    // spawn with max body
    const youngHaulers = roomw.find(FIND_MY_CREEPS, {
      filter: c => c.memory.role === Hauler.ROLE && c.ticksToLive && c.ticksToLive > 1000
    });
    CreepUtils.consoleLogIfWatched(roomw, `haulers: ${youngHaulers.length} younger than 1000`);
    if (youngHaulers.length === 0 && haulers.length <= roomw.sources.length + 1) {
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
    CreepUtils.consoleLogIfWatched(roomw, `haulers: ${haulers.length}/${sourcesPlusOne}`);
    if (haulers.length < sourcesPlusOne) {
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
