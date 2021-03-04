import "./prototypes/creep";

import { CreepUtils } from "creep-utils";
import { Planner } from "planning/planner";
import { Harvester } from "roles/harvester";
import { Hauler } from "roles/hauler";
import { Spawner } from "roles/spawner";
import { Worker } from "roles/worker";
import { ErrorMapper } from "utils/ErrorMapper";

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = ErrorMapper.wrapLoop(() => {
  console.log(`Current game tick is ${Game.time}`);
  cleanupDeadCreepNames();

  // Run each room
  const roomIds = Game.rooms;
  for (const roomId in roomIds) {
    const room = Game.rooms[roomId];
    runLogging(room);

    // Run spawners
    CreepUtils.consoleLogIfWatched(room, `running spawns`);
    const spawns = room.find(FIND_MY_SPAWNS);
    for (let i = 0; i < spawns.length; i++) {
      const spawn = spawns[i];
      let spawner = new Spawner(spawn);
      spawner.spawnCreeps();
    }

    CreepUtils.consoleLogIfWatched(room, `running towers`);
    runTowers(room);

    // Plan each room every 10 ticks
    if (room.controller && Game.time % 10 == 0) {
      const planner = new Planner(room);
      planner.run();
    }
  }

  runCreeps();
});

function runLogging(room: Room) {
  if (!room.memory.construction) {
    room.memory.construction = {};
  }

  // add all construction sites to log
  const constructionSites = room.find(FIND_MY_CONSTRUCTION_SITES);
  for (let i = 0; i < constructionSites.length; i++) {
    const site = constructionSites[i];
    if (!room.memory.construction[site.id]) {
      room.memory.construction[site.id] = { id: site.id, type: site.structureType, pos: site.pos, startTime: Game.time };
    }
  }

  // update any completed ones
  for (let id in room.memory.construction) {
    const site = Game.getObjectById(room.memory.construction[id].id);
    if (site && site.progress <= site.progressTotal) {
      room.memory.construction[id].progress = site.progress / site.progressTotal;
    }
    else if (!site && !room.memory.construction[id].endTime) {
      room.memory.construction[id].endTime = Game.time;
      room.memory.construction[id].progress = 1;
    }
  }

  // log when 5 extensions reached
  const lastExtensionCount = room.memory.extensionCount;
  const extensionCount = room.find(FIND_MY_STRUCTURES, { filter: (s) => s.structureType == STRUCTURE_EXTENSION }).length;
  room.memory.extensionCount = extensionCount;
  if (extensionCount != lastExtensionCount && extensionCount == 1) {
    CreepUtils.roomMemoryLog(room, 'reached 1 extensions');
  }
  else if (extensionCount != lastExtensionCount && extensionCount == 5) {
    CreepUtils.roomMemoryLog(room, 'reached 5 extensions');
  }
}

// TODO: make a tower wrapper class
function runTowers(room: Room) {
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

function runCreeps() {
  for (let name in Game.creeps) {
    let creep = Game.creeps[name];
    const onRoad = creep.pos.lookFor(LOOK_STRUCTURES).filter((s) => s.structureType == STRUCTURE_ROAD).length > 0;
    if (onRoad) {
      CreepUtils.touchRoad(creep.pos);
    }

    if (creep.memory.role == 'worker') {
      Worker.run(creep);
    }
    else if (creep.memory.role == 'harvester') {
      let harvester = new Harvester(creep);
      harvester.run();
    }
    else if (creep.memory.role == 'hauler') {
      let hauler = new Hauler(creep);
      hauler.run();
    }
    else {
      console.log(`unknown role: ${creep.memory.role}`);
    }
  }
}

// Automatically delete memory of missing creeps
function cleanupDeadCreepNames() {
  for (const name in Memory.creeps) {
    if (!(name in Game.creeps)) {
      delete Memory.creeps[name];
    }
  }
}
