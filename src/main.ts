import { CreepUtils } from "creep-utils";
import { ContainerPlan } from "planning/container-plan";
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
    runLogging(room);

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
    if (room.controller && Game.time % 10 == 0) {
      if (room.controller?.level > 1) {
        console.log(`${room.name}: running planning`);

        let containerPlan = new ContainerPlan(room);
        containerPlan.planContainers();

        // place available extensions
        let extensionPlan = new ExtensionPlan(room);
        extensionPlan.planExtensionGroup();

        // TODO: make controller road come from source with container only
        // let roadPlan = new RoadPlan(room);
        // roadPlan.placeControllerRoad();
      }
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
    if(!room.memory.construction[site.id]) {
      room.memory.construction[site.id] = { id: site.id, type: site.structureType, pos: site.pos, startTime: Game.time };
    }
  }

  // update any completed ones
  for (let id in room.memory.construction) {
    const site = Game.getObjectById(room.memory.construction[id].id);
    if(site && site.progress <= site.progressTotal){
      room.memory.construction[id].progress = site.progress / site.progressTotal;
    }
    else if(!site) {
      room.memory.construction[id].endTime = Game.time;
      room.memory.construction[id].progress = 1;
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
