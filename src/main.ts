import { ErrorMapper } from "utils/ErrorMapper";

export const loop = ErrorMapper.wrapLoop(() => {
  // console.log(`Current game tick is ${Game.time}`);
  cleanupDeadCreepNames();


  const flag1 = Game.flags['Flag1'];
  const flag2 = Game.flags['Flag2'];

  const cost = PathFinder.search(Game.flags['Flag1'].pos, Game.flags['Flag2'].pos, {
    plainCost: 2,
    swampCost: 10,
    roomCallback: (roomName) => {
      let room = Game.rooms[roomName];
      if (!room) return false;

      let costs = new PathFinder.CostMatrix;

      room.find(FIND_STRUCTURES).forEach((struct) => {
        if (struct.structureType === STRUCTURE_ROAD) {
          costs.set(struct.pos.x, struct.pos.y, 1);
        }
      });

      return costs;
    }
  }).cost;
  console.log(`Path cost: ${cost}`);

  let creep = _.first(Object.values(Game.creeps));
  if (creep) {
    creep.body.forEach((part) => console.log(part.type));
    const moveParts = creep.body.filter((part) => { part.type == MOVE });
    moveParts.forEach((part) => console.log(part.type));
    const movePartCount = moveParts.length;
    const heavyParts = creep.body.filter((part) => { part.type != MOVE && part.type != CARRY }).length;
    console.log(`move: ${movePartCount}, heavy: ${heavyParts}`);
    const estimate = (cost * heavyParts) / (movePartCount * 2);
    console.log(`Adjusted estimate: ${estimate}`);

    if (creep.memory.dest && creep.pos.isEqualTo(Game.flags[creep.memory.dest].pos)) {
      const runTime = Game.time - creep.memory.startTime;
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
