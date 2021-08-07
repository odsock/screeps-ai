import { CreepUtils } from "creep-utils";
import { Planner } from "planning/planner";
import { CreepFactory } from "roles/creep-factory";
import { RoomWrapper } from "structures/room-wrapper";
import { SpawnWrapper } from "structures/spawn-wrapper";
import { TowerWrapper } from "structures/tower-wrapper";

export class Sockpuppet {
  public run(): void {
    // Run each room
    for (const roomId in Game.rooms) {
      const room = new RoomWrapper(Game.rooms[roomId]);
      const planner = new Planner(room);

      // Init room memory if needed
      if (Object.keys(room.memory).length === 0) {
        planner.setupRoomMemory();
      }

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
