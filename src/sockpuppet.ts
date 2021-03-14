import { CreepUtils } from "creep-utils";
import { Planner } from "planning/planner";
import { Harvester } from "roles/harvester";
import { Hauler } from "roles/hauler";
import { Spawn } from "structures/spawn";
import { Worker } from "roles/worker";
import { RoomWrapper } from "structures/room-wrapper";
import { Builder } from "roles/builder";

export class Sockpuppet {
  public run() {
    // Run each room
    const roomIds = Game.rooms;
    for (const roomId in roomIds) {
      const room = new RoomWrapper(roomId);

      // Run spawners
      CreepUtils.consoleLogIfWatched(room, `running spawns`);
      const spawns = room.find(FIND_MY_SPAWNS);
      for (let i = 0; i < spawns.length; i++) {
        const spawn = spawns[i];
        let spawner = new Spawn(spawn);
        spawner.spawnCreeps();
      }

      CreepUtils.consoleLogIfWatched(room, `running towers`);
      this.runTowers(room);

      // Plan each room every 10 ticks
      if (room.controller && Game.time % 10 == 0) {
        const planner = new Planner(room);
        planner.run();
      }
    }

    this.runCreeps();
  }

  public runCreeps(): void {
    for (let name in Game.creeps) {
      let creep = Game.creeps[name];
      if (!creep.spawning) {
        if (creep.memory.role == 'worker') {
          const worker = new Worker(creep);
          // const worker = {...creep} as Worker;
          worker.run();
        }
        else if (creep.memory.role == 'harvester') {
          // const harvester = {...creep} as Harvester;
          const harvester = new Harvester(creep);
          harvester.run();
        }
        else if (creep.memory.role == 'hauler') {
          let hauler = new Hauler(creep);
          hauler.run();
        }
        else if (creep.memory.role == 'builder') {
          let builder = new Builder(creep);
          builder.run();
        }
        else {
          console.log(`unknown role: ${creep.memory.role}`);
        }
      }
    }
  }

  // TODO: make a tower wrapper class
  public runTowers(room: Room) {
    const towers = room.find(FIND_MY_STRUCTURES, { filter: (s) => s.structureType == STRUCTURE_TOWER }) as StructureTower[];
    for (let i = 0; i < towers.length; i++) {
      const tower = towers[i];
      const closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
      if (closestHostile) {
        tower.attack(closestHostile);
      }
      else {
        const closestDamagedStructure = tower.pos.findClosestByRange(FIND_STRUCTURES, {
          filter: (structure) => structure.hits < structure.hitsMax && structure.structureType != STRUCTURE_ROAD
        });
        if (closestDamagedStructure) {
          tower.repair(closestDamagedStructure);
        }
        else {
          const closestDamagedRoad = tower.pos.findClosestByRange(FIND_STRUCTURES, {
            filter: (structure) => {
              if (!(structure.structureType == STRUCTURE_ROAD)) return false;
              const isDamagedRoad = structure.hits < structure.hitsMax;
              const isUsedRoad = room.memory.roadUseLog[`${structure.pos.x},${structure.pos.y}`] > 0;
              if (!isUsedRoad && isDamagedRoad) {
                CreepUtils.consoleLogIfWatched(room, `not repairing unused road: ${structure.pos.x},${structure.pos.y}`);
              }
              return isDamagedRoad && isUsedRoad;
            }
          });
          if (closestDamagedRoad) {
            tower.repair(closestDamagedRoad);
          }
        }
      }
    }
  }
}