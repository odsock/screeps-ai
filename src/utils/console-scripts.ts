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

global.profile = (key: Id<any> | string) => {
  let watchable: Watchable | null = Game.getObjectById(key) as Watchable;
  if (Game.creeps[key]) {
    watchable = Game.creeps[key] as Watchable;
  } else if (Game.spawns[key]) {
    watchable = Game.spawns[key] as Watchable;
  } else if (Game.rooms[key]) {
    watchable = Game.rooms[key] as Watchable;
  } else if (key === "sockpuppet") {
    watchable = global.sockpuppet as Watchable;
  }
  if (watchable) {
    watchable.memory.profile = true;
  }
};

global.unprofile = (key: Id<any>) => {
  let watchable: Watchable | null = Game.getObjectById(key) as Watchable;
  if (Game.creeps[key]) {
    watchable = Game.creeps[key] as Watchable;
  } else if (Game.spawns[key]) {
    watchable = Game.spawns[key] as Watchable;
  }
  if (watchable) {
    watchable.memory.profile = false;
  }
};

global.printCpuUsage = () => {
  console.log(`<b>CPU SUMMARY</b>`);

  const tickTotal = Memory.cpu.tickTotal;
  const cpuAverageTick = tickTotal.reduce((average, tick) => average + tick / Memory.cpu.tickTotal.length, 0);
  console.log(`<b>CPU tick average:</b> ${cpuAverageTick} over ${Memory.cpu.tickTotal.length} ticks`);

  const allCreeps = Memory.cpu.allCreeps;
  const cpuAverageCreeps = allCreeps.reduce((average, cpu) => average + cpu / allCreeps.length, 0);
  console.log(`<b>CPU creeps average:</b> ${cpuAverageCreeps} over ${allCreeps.length} ticks`);

  console.log(`<b>CPU creep averages:</b>`);
  for (const role in Memory.cpu.creepsByRole) {
    const roleHistory = Memory.cpu.creepsByRole[role];
    const cpuAverageRole = roleHistory.reduce((average, cpu) => average + cpu / roleHistory.length, 0);
    console.log(`- ${role.toUpperCase()}: ${cpuAverageRole} over ${roleHistory.length} ticks`);
  }
};

global.clearCpuUsage = () => {
  Memory.cpu = { allCreeps: [], creepsByRole: {}, tickTotal: [] };
};
