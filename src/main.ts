import { ErrorMapper } from "utils/ErrorMapper";

export const loop = ErrorMapper.wrapLoop(() => {
  const flag1 = Game.flags['Flag1'];
  const flag2 = Game.flags['Flag2'];

  let creep = _.first(Object.values(Game.creeps));
  if (creep) {
    if (creep.memory.dest && creep.pos.isEqualTo(Game.flags[creep.memory.dest].pos)) {
      const cost = getBaseCost(flag1, flag2);
      console.log(`Base path cost: ${cost}`);

      const moveParts = creep.body.filter((p) => p.type == MOVE).length;
      const heavyParts = creep.body.filter((p) => p.type != MOVE && p.type != CARRY).length;
      console.log(`move: ${moveParts}, heavy: ${heavyParts}`);

      const moveRatio = heavyParts / (moveParts);
      console.log(`Move ratio: ${moveRatio}`);

      const estimate = cost * moveRatio;
      console.log(`Adjusted estimate: ${estimate}`);

      const runTime = Game.time - creep.memory.startTime;
      console.log(`Run time: ${runTime}`);
    }

    let result: ScreepsReturnCode = OK;
    if (creep.pos.isEqualTo(flag1.pos)) {
      creep.memory.dest = 'Flag2';
      result = creep.moveTo(Game.flags[creep.memory.dest]);
      if(result == OK) {
        creep.memory.startTime = Game.time;
      }
    }
    else if (creep.pos.isEqualTo(flag2.pos)) {
      creep.memory.dest = 'Flag1';
      result = creep.moveTo(Game.flags[creep.memory.dest]);
      if(result == OK) {
        creep.memory.startTime = Game.time;
      }
    }
    else {
      result = creep.moveTo(Game.flags[creep.memory.dest]);
      console.log(`move result: ${result}`);
    }
  }
});

function getBaseCost(flag1: Flag, flag2: Flag) {
  return PathFinder.search(flag1.pos, flag2.pos, {
    plainCost: 2,
    swampCost: 10,
    roomCallback: (roomName) => {
      let room = Game.rooms[roomName];
      if (!room)
        return false;

      let costs = new PathFinder.CostMatrix;

      room.find(FIND_STRUCTURES).forEach((struct) => {
        if (struct.structureType === STRUCTURE_ROAD) {
          costs.set(struct.pos.x, struct.pos.y, 1);
        }
      });

      return costs;
    }
  }).cost;
}
