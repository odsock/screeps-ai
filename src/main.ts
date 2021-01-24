import { ErrorMapper } from "utils/ErrorMapper";

var roleHarvester = require('role.harvester');
var roleUpgrader = require('role.upgrader');
var roleBuilder = require('role.builder');
var roleSpawner = require('role.spawner');

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = ErrorMapper.wrapLoop(() => {
  console.log(`Current game tick is ${Game.time}`);

  cleanupDeadCreepNames();
  breedNewCreeps();
  runCreeps();
});

function runCreeps() {
  for (var name in Game.creeps) {
      var creep = Game.creeps[name];
      if (creep.memory.role == 'harvester') {
          roleHarvester.run(creep);
      }
      if (creep.memory.role == 'upgrader') {
          roleUpgrader.run(creep);
      }
      if (creep.memory.role == 'builder') {
          roleBuilder.run(creep);
      }
  }
}

function breedNewCreeps() {
  var harvesters = _.filter(Game.creeps, (creep) => creep.memory.role == 'harvester');
  roleSpawner.breed(harvesters, 'harvester', 2);

  var upgraders = _.filter(Game.creeps, (creep) => creep.memory.role == 'upgrader');
  roleSpawner.breed(upgraders, 'upgrader', 2);

  var builders = _.filter(Game.creeps, (creep) => creep.memory.role == 'builder');
  roleSpawner.breed(builders, 'builder', 2);
}

function cleanupDeadCreepNames() {
  // Automatically delete memory of missing creeps
  for (const name in Memory.creeps) {
    if (!(name in Game.creeps)) {
      delete Memory.creeps[name];
    }
  }
}
