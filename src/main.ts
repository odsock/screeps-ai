import { ErrorMapper } from "utils/ErrorMapper";

export const loop = ErrorMapper.wrapLoop(() => {
  console.log(`Current game tick is ${Game.time}`);
  cleanupDeadCreepNames();

  const flag1 = Game.flags['Flag1'];
  const flag2 = Game.flags['Flag2'];

  let creep = _.first(Object.values(Game.creeps));

  if (creep) {
    if (creep.memory.dest && creep.pos.isEqualTo(Game.flags[creep.memory.dest].pos)) {
      const runTime = Game.time - creep.memory.startTime;
      const estimate = PathFinder.search(Game.flags['Flag1'].pos, Game.flags['Flag2'].pos, { plainCost: 2, swampCost: 10 }).cost;
      console.log(`Estimate: ${estimate}`);
      console.log(`Run time: ${runTime}`);
    }

    if (creep.pos.isEqualTo(flag1.pos)) {
      creep.memory.dest = 'Flag2';
      creep.memory.startTime = Game.time;
      // console.log(`Start time: ${Game.time}`);
    }
    else if (creep.pos.isEqualTo(flag2.pos)) {
      creep.memory.dest = 'Flag1';
      creep.memory.startTime = Game.time;
      // console.log(`Start time: ${Game.time}`);
    }

    creep.moveTo(Game.flags[creep.memory.dest]);
  }
});

function cleanupDeadCreepNames() {
  // Automatically delete memory of missing creeps
  for (const name in Memory.creeps) {
    if (!(name in Game.creeps)) {
      delete Memory.creeps[name];
    }
  }
}
