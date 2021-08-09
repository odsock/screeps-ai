/* eslint-disable */
global.watch = function (creepName) {
  Game.creeps[creepName].memory.watched = true;
};
global.unwatch = function (creepName) {
  Game.creeps[creepName].memory.watched = false;
};
