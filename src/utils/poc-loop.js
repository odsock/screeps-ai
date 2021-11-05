module.exports.loop = function () {
  console.log('booger');
  if (!Game.creeps.hauler || !Game.creeps.harvester) {
    console.log('spawning');
    Game.spawns.Spawn1.spawnCreep([MOVE], 'hauler');
    Game.spawns.Spawn1.spawnCreep([WORK], 'harvester');
    return;
  }

  const hauler = Game.creeps.hauler;
  const harvester = Game.creeps.harvester;

  if (hauler.pos.roomName === harvester.pos.roomname && !hauler.pos.isNearTo(harvester)) {
    console.log('moving to harvester');
    hauler.moveTo(harvester);
    return;
  }

  console.log('setup pull');
  hauler.pull(harvester);
  harvester.move(hauler);

  const targetRoom = 'W5N1';

  if (hauler.pos.roomName !== targetRoom) {
    console.log('moving');
    const haulerPathToTarget = hauler.pos.findPathTo(new RoomPosition(10, 10, targetRoom));
    if (haulerPathToTarget.length === 0) {
      hauler.memory.step = 1;
      const result = hauler.moveTo(harvester);
      console.log(`haul last step ${result}`);
    } else {
      const haulResult = hauler.moveByPath(haulerPathToTarget);
      console.log(`haulResult: ${haulResult}`)
    }
    return;
  } else {
    switch (hauler.memory.step) {
      case 1:
        hauler.move(LEFT);
        hauler.memory.step = 2;
        break;

      case 2:
        if (harvester.pos.roomName === targetRoom) {
          hauler.move(LEFT);
        }
        delete hauler.memory.step;
        break;

      default:
        break;
    }

  }


  console.log('unreachable');
}