import { ExtensionPlan } from "planning/extension-plan";
import { PlannerUtils } from "planning/planner-utils";
import { RoadPlan } from "planning/road-plan";
import { Harvester } from "roles/harvester";
import { Spawner } from "roles/spawner";
import { Worker } from "roles/worker";
import { ErrorMapper } from "utils/ErrorMapper";

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = ErrorMapper.wrapLoop(() => {
  console.log(`Current game tick is ${Game.time}`);
  cleanupDeadCreepNames();

  for (const spawn in Game.spawns) {
    let spawner = new Spawner(Game.spawns[spawn]);
    spawner.spawnCreeps();
  };

  let roadPlan = new RoadPlan(Game.spawns['Spawn1'].room);
  roadPlan.placeControllerRoads();
  roadPlan.planExtensionRoads();

  let extensionPlan = new ExtensionPlan(Game.spawns['Spawn1'].room);
  extensionPlan.planExtensionGroup();
  
  runCreeps();

  // HACK: refactor this tower stuff
  var tower = Game.getObjectById('601722c64c0ffe4790223264') as StructureTower;
    if(tower) {
        var closestDamagedStructure = tower.pos.findClosestByRange(FIND_STRUCTURES, {
            filter: (structure) => structure.hits < structure.hitsMax
        });
        if(closestDamagedStructure) {
            tower.repair(closestDamagedStructure);
        }

        var closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
        if(closestHostile) {
            tower.attack(closestHostile);
        }
    }

});

function runCreeps() {
  for (let name in Game.creeps) {
    let creep = Game.creeps[name];

    if (creep.memory.role == 'worker') {
      Worker.run(creep);
    }
    else if(creep.memory.role == 'harvester') {
      let harvester = new Harvester(creep);
      harvester.run();
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
