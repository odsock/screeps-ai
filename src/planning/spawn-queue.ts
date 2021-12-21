import { SpawnRequest } from "structures/spawn-wrapper";
import { profile } from "../../screeps-typescript-profiler";
import { MemoryUtils } from "./memory-utils";

@profile
export class SpawnQueue {
  private readonly queue: SpawnRequest[] = [];

  /**
   * Manages singleton SpawnQueues for all rooms this tick.
   * @param roomArg Name of room, or a Room object
   * @returns Instance of SpawnQueue for the room, from cache if possible.
   */
  public static getInstance(roomArg: string | Room): SpawnQueue {
    const name = roomArg instanceof Room ? roomArg.name : roomArg;
    const instance = MemoryUtils.getCache<SpawnQueue>(`${name}_SpawnQueue`);
    if (instance) {
      return instance;
    } else {
      const room = roomArg instanceof Room ? roomArg : Game.rooms[name];
      console.log(`DEBUG: spawnqueue new queue - ${String(roomArg)}, ${String(room)}`);
      if (room) {
        console.log(`DEBUG: valid room`);
        const newInstance = new SpawnQueue();
        MemoryUtils.setCache(`${name}_SpawnQueue`, newInstance);
        return newInstance;
      }
      throw new Error(`ERROR: invalid room name ${name}`);
    }
  }

  /** adds request to spawn queue */
  public push(request: SpawnRequest): void {
    this.queue.push(request);
  }

  /** pops the highest priority request in queue */
  public pop(): SpawnRequest | undefined {
    let request: SpawnRequest | undefined;
    let requestIndex = -1;
    for (let i = 0; i < this.queue.length; i++) {
      if (!request || request.priority < this.queue[i].priority) {
        request = this.queue[i];
        requestIndex = i;
      }
    }
    if (request) {
      this.queue.splice(requestIndex, 1);
    }

    return request;
  }
}
