import { ErrorMapper } from "utils/ErrorMapper";

export const loop = ErrorMapper.wrapLoop(() => {
  const flag1 = Game.flags['Flag1'];
  const flag2 = Game.flags['Flag2'];

  let creep = _.first(Object.values(Game.creeps));
  if (creep) {
    if (creep.memory.dest && creep.memory.start && creep.pos.isEqualTo(Game.flags[creep.memory.dest].pos)) {
      console.log();

      let roadCount = 0;
      let plainCount = 0;
      let spwampCount = 0;
      const path = getBaseCost(Game.flags[creep.memory.start], Game.flags[creep.memory.dest]);
      const terrain = creep.room.getTerrain();
      path.path.forEach((pos) => {
        if (pos.lookFor(LOOK_STRUCTURES).filter((s) => s.structureType == STRUCTURE_ROAD).length > 0) {
          roadCount++;
        }
        else if (terrain.get(pos.x, pos.y) == TERRAIN_MASK_SWAMP) {
          spwampCount++;
        }
        else {
          plainCount++;
        }
      });

      console.log(`Base path cost: ${path.cost}, roads: ${roadCount}, plains: ${plainCount}, swamp: ${spwampCount}`);

      const moveParts = creep.body.filter((p) => p.type == MOVE).length;
      const heavyParts = creep.body.filter((p) => p.type != MOVE && p.type != CARRY).length;
      console.log(`move: ${moveParts}, heavy: ${heavyParts}`);

      const moveRatio = heavyParts / (moveParts * 2);

      const plainCost = Math.ceil(2 * moveRatio) * plainCount;
      const roadCost = Math.ceil(1 * moveRatio) * roadCount;
      const spwampCost = Math.ceil(10 * moveRatio) * spwampCount;

      const estimate = roadCost + plainCost + spwampCost + 1;
      console.log(`Adjusted estimate: ${estimate}`);

      const runTime = Game.time - creep.memory.startTime;
      console.log(`Run time: ${runTime}`);
      console.log();
    }

    let result: ScreepsReturnCode = OK;
    if (creep.pos.isEqualTo(flag1.pos)) {
      creep.memory.start = 'Flag1';
      creep.memory.dest = 'Flag2';
      result = creep.moveTo(Game.flags[creep.memory.dest]);
      if (result == OK) {
        creep.memory.startTime = Game.time;
        console.log(`move result: ${result}`);
      }
    }
    else if (creep.pos.isEqualTo(flag2.pos)) {
      creep.memory.start = 'Flag2';
      creep.memory.dest = 'Flag1';
      result = creep.moveTo(Game.flags[creep.memory.dest]);
      if (result == OK) {
        creep.memory.startTime = Game.time;
        console.log(`move result: ${result}`);
      }
    }
    else {
      result = creep.moveTo(Game.flags[creep.memory.dest]);
      console.log(`move result: ${result}`);
    }
  }
});

function getBaseCost(flag1: Flag, flag2: Flag) {
  return PathFinder.search(flag1.pos, { pos: flag2.pos, range: 1 }, {
    plainCost: 2,
    swampCost: 10,
    roomCallback: (roomName) => {
      let room = Game.rooms[roomName];
      if (!room) {
        return false;
      }
      let costs = new PathFinder.CostMatrix;
      room.find(FIND_STRUCTURES).forEach((struct) => {
        if (struct.structureType === STRUCTURE_ROAD) {
          costs.set(struct.pos.x, struct.pos.y, 1);
        }
      });
      return costs;
    }
  });
}
