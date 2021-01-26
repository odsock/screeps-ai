import { RoleSpawner } from "role.spawner";
import { RoleWorker } from "role.worker";
import { ErrorMapper } from "utils/ErrorMapper";

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = ErrorMapper.wrapLoop(() => {
  console.log(`Current game tick is ${Game.time}`);

  cleanupDeadCreepNames();
  breedNewCreeps(4);
  runCreeps();
});

function runCreeps() {
  for (let name in Game.creeps) {
    let creep = Game.creeps[name];
    // balanceRoles(creep);

    if (creep.memory.role == 'worker') {
      console.log(`worker: ${creep.name}`);
      RoleWorker.run(creep);
    }
    else {
      console.log(`unknown role: ${creep.memory.role}`);
    }
  }
}

// function balanceRoles(creep: Creep) {
//   let targets = creep.room.find(FIND_CONSTRUCTION_SITES);
//   if (targets.length > 0) {

//   }
//   if (creep.memory.idle == true) {
//     let oldRole = creep.memory.role;
//     if (oldRole == 'harvester') {
//       creep.memory.role = 'builder';
//     }
//     if (oldRole == 'builder') {
//       creep.memory.role = 'upgrader';
//     }
//     if (oldRole == 'upgrader') {
//       creep.memory.role = 'harvester';
//     }
//     console.log(`Reassigning idle ${oldRole} to: ${creep.memory.role}`);
//     creep.memory.idle = false;
//   }
// }

function breedNewCreeps(maxCreeps: number) {
  if(_.size(Game.creeps) < maxCreeps) {
    let workers = _.filter(Game.creeps, (creep) => creep.memory.role == 'worker');
    RoleSpawner.breed(workers, 'worker', maxCreeps);

    // let harvesters = _.filter(Game.creeps, (creep) => creep.memory.role == 'harvester');
    // RoleSpawner.breed(harvesters, 'harvester', 1);

    // let upgraders = _.filter(Game.creeps, (creep) => creep.memory.role == 'upgrader');
    // RoleSpawner.breed(upgraders, 'upgrader', 6);

    // let builders = _.filter(Game.creeps, (creep) => creep.memory.role == 'builder');
    // RoleSpawner.breed(builders, 'builder', 1);
  }
}

function cleanupDeadCreepNames() {
  // Automatically delete memory of missing creeps
  for (const name in Memory.creeps) {
    if (!(name in Game.creeps)) {
      delete Memory.creeps[name];
    }
  }
}
