import { RoleSpawner } from "role.spawner";
import { RoleWorker } from "role.worker";
import { ErrorMapper } from "utils/ErrorMapper";

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = ErrorMapper.wrapLoop(() => {
  console.log(`Current game tick is ${Game.time}`);

  cleanupDeadCreepNames();
  RoleSpawner.spawnCreeps();
  runCreeps();
});

function runCreeps() {
  for (let name in Game.creeps) {
    let creep = Game.creeps[name];

    if (creep.memory.role == 'worker') {
      RoleWorker.run(creep);
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
