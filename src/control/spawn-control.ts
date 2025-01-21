import { CreepUtils } from "creep-utils";
import { SpawnQueue } from "planning/spawn-queue";
import { Worker } from "roles/worker";
import { RoomWrapper } from "structures/room-wrapper";
import { SpawnWrapper } from "structures/spawn-wrapper";

export class SpawnControl {
  private readonly rcl: number;
  private readonly freeSpawns: SpawnWrapper[];
  private readonly spawnQueue: SpawnQueue;

  public constructor(private readonly roomw: RoomWrapper) {
    this.spawnQueue = SpawnQueue.getInstance(roomw);

    this.freeSpawns = this.roomw.spawns.filter(spawnw => !spawnw.spawning);
    this.rcl = this.roomw.controller?.level ? this.roomw.controller?.level : 0;
  }

  public run(): void {
    this.cleanupSpawningMemory();
    this.printSpawningVisual();

    if (this.freeSpawns.length === 0) {
      return;
    }

    // fill spawn queue with requests (may already have some)
    if (this.rcl <= 1) {
      // SEED WORKER
      // spawn one worker if no other creeps
      if (this.roomw.find(FIND_MY_CREEPS).length === 0) {
        this.spawnQueue.push({
          bodyProfile: Worker.BODY_PROFILE,
          memory: { role: Worker.ROLE },
          priority: 200
        });
      }
    }

    this.workSpawnQueue();
  }

  private cleanupSpawningMemory() {
    _.forEach(Game.spawns, spawn => {
      if (spawn.spawning?.name != spawn.memory.spawning?.name) {
        delete spawn.memory.spawning;
      }
    });
  }

  private workSpawnQueue(): void {
    CreepUtils.consoleLogIfWatched(this.roomw, `spawn queue: ${JSON.stringify(this.spawnQueue)}`);
    this.freeSpawns.some(s => {
      const spawnRequest = this.spawnQueue.pop();
      if (spawnRequest) {
        const result = s.spawn(spawnRequest);
        CreepUtils.consoleLogIfWatched(
          this.roomw,
          `spawning: ${spawnRequest.memory.role}, priority: ${spawnRequest.priority}`,
          result
        );
        // don't use energy on lower priority creep if high priority couldn't spawn now
        return result === ERR_NOT_ENOUGH_ENERGY;
      }
      return true;
    });
  }

  /** prints room visual of spawning role */
  private printSpawningVisual() {
    this.freeSpawns.forEach(spawn => {
      if (spawn.spawning) {
        const spawningCreep = Game.creeps[spawn.spawning.name];
        // try to stagger visuals so they don't overlap
        const offset = Number(spawn.name.slice(-1)) % 2 === 0 ? 1 : -1;
        this.roomw.visual.text("🐣" + spawningCreep.memory.role, spawn.pos.x, spawn.pos.y + offset, {
          align: "left",
          opacity: 0.8
        });
      }
    });
  }
}
