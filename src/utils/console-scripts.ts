import { Watchable } from "creep-utils";

global.watch = (key: Id<any>) => {
  let watchable: Watchable | null = Game.getObjectById(key) as Watchable;
  if (Game.creeps[key]) {
    watchable = Game.creeps[key] as Watchable;
  } else if (Game.spawns[key]) {
    watchable = Game.spawns[key] as Watchable;
  }
  if (watchable) {
    watchable.memory.watched = true;
  }
};

global.unwatch = (key: Id<any>) => {
  let watchable: Watchable | null = Game.getObjectById(key) as Watchable;
  if (Game.creeps[key]) {
    watchable = Game.creeps[key] as Watchable;
  } else if (Game.spawns[key]) {
    watchable = Game.spawns[key] as Watchable;
  }
  if (watchable) {
    watchable.memory.watched = false;
  }
};

global.printCpuUsage = () => {
  console.log(`CPU SUMMARY BY CREEP ROLE`);
  for (const role in Memory.cpu.creepsByRole) {
    const roleHistory = Memory.cpu.creepsByRole[role];
    const cpuAverageTick = roleHistory.reduce((average, cpu) => average + cpu / roleHistory.length, 0);
    console.log(`${role.toUpperCase()}: average ${cpuAverageTick} over ${roleHistory.length} ticks`);
  }
};

global.clearCpuUsage = () => {
  Memory.cpu.creepsByRole = {};
};
