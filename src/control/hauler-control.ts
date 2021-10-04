import { Hauler } from "roles/hauler";
import { RoomWrapper } from "structures/room-wrapper";

export enum TaskType {
  HAUL = "haul"
}

export interface Task {
  type: TaskType;
  target: string;
}

export class HaulerControl {
  public run(): void {
    for (const roomName in Game.rooms) {
      const roomw = RoomWrapper.getInstance(roomName);
      const haulers = roomw.find(FIND_MY_CREEPS, { filter: c => c.memory.role === "hauler" }).map(c => new Hauler(c));

      // create haul tasks
      const creepsToHaul = this.getHaulRequesters(roomw);
      // assign to empty hauler with no other task
      const emptyHaulers = haulers.filter(h => h.store.getUsedCapacity() === 0 && !h.memory.hauleeName);
      creepsToHaul.forEach(c => {
        const closestHauler = c.pos.findClosestByPath(emptyHaulers);
        if (closestHauler) {
          closestHauler.memory.hauleeName = c.name;
          c.memory.haulerName = closestHauler?.name;
          emptyHaulers.splice(emptyHaulers.findIndex(h => h.id === closestHauler.id));
        }
      });
    }
  }

  private getHaulRequesters(roomw: RoomWrapper): Creep[] {
    return roomw.find(FIND_MY_CREEPS, {
      filter: creep => creep.memory.haulRequested && !creep.memory.haulerName
    });
  }
}
