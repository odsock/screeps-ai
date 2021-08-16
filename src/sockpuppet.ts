import { CreepUtils } from "creep-utils";
import { MemoryUtils } from "planning/memory-utils";
import { Planner } from "planning/planner";
import { CreepFactory } from "roles/creep-factory";
import { RoomWrapper } from "structures/room-wrapper";
import { SpawnWrapper } from "structures/spawn-wrapper";
import { TowerWrapper } from "structures/tower-wrapper";

export class Sockpuppet {
  public run(): void {
    // refresh global cache if missing
    // MemoryUtils.readCacheFromMemory();

    // Run each room
    for (const roomId in Game.rooms) {
      const room = new RoomWrapper(Game.rooms[roomId]);

      // draw colony poc
      const planVisual = room.planVisual;
      if (planVisual) {
        room.visual.import(planVisual);
      }

      // draw dismantle queue
      const dismantleVisual = room.dismantleVisual;
      if (dismantleVisual) {
        room.visual.import(dismantleVisual);
      }

      const planner = new Planner(room);
      // TODO refresh every turn maybe excessive?
      MemoryUtils.refreshRoomMemory(room);

      // Run spawners
      CreepUtils.consoleLogIfWatched(room, `running spawns`);
      const spawns = room.find(FIND_MY_SPAWNS);
      for (const spawn of spawns) {
        const spawner = new SpawnWrapper(spawn);
        spawner.spawnCreeps();
      }

      CreepUtils.consoleLogIfWatched(room, `running towers`);
      this.runTowers(room);

      // Plan each room every 10 ticks
      if (Game.time % 10 === 0) {
        const result = planner.run();
        console.log(`planning result: ${result}`);
      }
    }

    this.runCreeps();

    // write global cache to memory
    // MemoryUtils.writeCacheToMemory();
  }

  public runCreeps(): void {
    for (const name in Game.creeps) {
      const creep = Game.creeps[name];
      if (!creep.spawning) {
        CreepFactory.getCreep(creep).run();
      }
    }
  }

  public runTowers(room: Room): void {
    const towers = room
      .find<StructureTower>(FIND_MY_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_TOWER
      })
      .map(t => new TowerWrapper(t));

    for (const tower of towers) {
      tower.run();
    }
  }
}
