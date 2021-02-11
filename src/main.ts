import { ExtensionPlan } from "planning/extension-plan";
import { PlannerUtils } from "planning/planner-utils";
import { RoadPlan } from "planning/road-plan";
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

    // Run spawners
    console.log(`${room.name}: running spawns`);
    const spawns = room.find(FIND_MY_SPAWNS);
    for (let i = 0; i < spawns.length; i++) {
      const spawn = spawns[i];
      let spawner = new Spawner(spawn);
      spawner.spawnCreeps();
    }

    console.log(`${room.name}: running towers`);
    runTowers(room);

    // Plan each room every 10 ticks
    if (Game.time % 10 == 0) {
      const conLevel = room.controller?.level;

      if (conLevel && conLevel > 1) {
        console.log(`${room.name}: running planning`);
        let extensionPlan = new ExtensionPlan(room);
        extensionPlan.planExtensionGroup();

        // TODO: make controller road come from source with container only
        // let roadPlan = new RoadPlan(room);
        // roadPlan.placeControllerRoad();

        // TODO: build container for each source one at a time
        placeContainers(room, spawns);
      }
    }
  }

  runCreeps();
});

function placeContainers(room: Room, spawns: StructureSpawn[]) {
  const containersInConstruction = room.find(FIND_MY_CONSTRUCTION_SITES, { filter: (s) => s.structureType == STRUCTURE_CONTAINER });
  if (containersInConstruction.length == 0) {
    for (let i = 0; i < spawns.length; i++) {
      const spawn = spawns[i];
      // find closest source with no adjacent container
      const source = spawn.pos.findClosestByPath(FIND_SOURCES, {
        filter: (s) => s.pos.findInRange(FIND_STRUCTURES, 1, {
          filter: (c) => c.structureType == STRUCTURE_CONTAINER
        }).length == 0
      });
      if(source) {
        let xOffset = 0;
        let yOffset = 0;
        const startPos = new RoomPosition(source.pos.x - 1, source.pos.y - 1, source.pos.roomName);
        let pos = startPos;
        while(room.createConstructionSite(pos, STRUCTURE_CONTAINER) != OK) {
          if(xOffset < 2 && yOffset == 0) {
            xOffset++;
          }
          else if(xOffset == 2 && yOffset < 2) {
            yOffset++;
          }
          else if(xOffset > 0 && yOffset == 2) {
            xOffset--;
          }
          else if(xOffset == 0 && yOffset > 0) {
            yOffset--;
          }

          if(xOffset == yOffset && xOffset == 0) {
            break;
          }
          pos = new RoomPosition(startPos.x + xOffset, startPos.y + yOffset, startPos.roomName);
        }
        console.log(`${room.name}: create container: ${pos.x},${pos.y}`);
      }
    }
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
        filter: (structure) => structure.hits < structure.hitsMax
      });
      if (closestDamagedStructure) {
        tower.repair(closestDamagedStructure);
      }
    }
  }
}

function runCreeps() {
  for (let name in Game.creeps) {
    let creep = Game.creeps[name];

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
