import { RoomWrapper } from "structures/room-wrapper";
import { SpawnWrapper } from "structures/spawn-wrapper";
import { Planner } from "planning/planner";
import { Builder } from "roles/builder";
import { CreepUtils } from "creep-utils";
import { Harvester } from "roles/harvester";
import { Hauler } from "roles/hauler";
import { Upgrader } from "roles/upgrader";
import { Worker } from "roles/worker";

export class Sockpuppet {
  public run(): void {
    // Run each room
    for (const roomId in Game.rooms) {
      const room = new RoomWrapper(Game.rooms[roomId]);

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
        const planner = new Planner(room);
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
        if (creep.memory.role === "worker") {
          const worker = new Worker(creep);
          worker.run();
        } else if (creep.memory.role === "harvester") {
          const harvester = new Harvester(creep);
          harvester.run();
        } else if (creep.memory.role === "hauler") {
          const hauler = new Hauler(creep);
          hauler.run();
        } else if (creep.memory.role === "builder") {
          const builder = new Builder(creep);
          builder.run();
        } else if (creep.memory.role === "upgrader") {
          const upgrader = new Upgrader(creep);
          upgrader.run();
        } else {
          console.log(`unknown role: ${creep.memory.role}`);
        }
      }
    }
  }

  // TODO: make a tower wrapper class
  // TODO: towers should heal creeps when nothing to kill
  public runTowers(room: Room): void {
    const towers = room.find(FIND_MY_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_TOWER
    }) as StructureTower[];

    for (const tower of towers) {
      this.runTower(tower, room);
    }
  }


}
