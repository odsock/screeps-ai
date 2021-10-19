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
    const spawnQueue = SpawnQueue.getInstance(roomw);

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

    if (haulerCount <= sourcesPlusOne) {
      SpawnUtils.requestReplacementCreep(roomw, Hauler);
    }
  }
}
