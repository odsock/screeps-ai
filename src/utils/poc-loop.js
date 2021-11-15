module.exports.loop = function () {
  console.log('-----tick-----');
  if (!Game.creeps.hauler || !Game.creeps.harvester) {
    console.log('spawning');
    Game.spawns.Spawn1.spawnCreep([MOVE], 'hauler');
    Game.spawns.Spawn1.spawnCreep([WORK], 'harvester');
    return;
  }

  const hauler = Game.creeps.hauler;
  console.log(`hauler pos: ${String(hauler.pos)}`)
  const harvester = Game.creeps.harvester;
  console.log(`harvester pos: ${String(harvester.pos)}`)

  // move hauler to harvester if not flagged working
  if (!hauler.memory.working && !hauler.pos.isNearTo(harvester)) {
    console.log('moving to harvester');
    hauler.moveTo(harvester);
    return;
  }

  console.log('working');
  hauler.memory.working = true;

  console.log('setup pull');
  hauler.pull(harvester);
  harvester.move(hauler);

  const targetPos = new RoomPosition(44, 32, 'W7N1');
  const path = hauler.pos.findPathTo(targetPos, {range: 1});

  // path length 1 means near target, or leaving room
  if (!hauler.memory.exitState && path.length === 1 && hauler.room.name !== targetPos.roomName) {
    hauler.memory.exitState = 1;
  }

  if (hauler.memory.exitState) {
    handleExit(hauler, harvester);
  } else {
    hauler.moveByPath(path);
  }
}

function handleExit(hauler, harvester) {
  const exitState = hauler.memory.exitState;
  console.log(exitState);
  const exitPos = hauler.pos.findClosestByRange(FIND_EXIT);
  console.log(`exitPos: ${String(exitPos)}`);
  let exitDir = hauler.pos.getDirectionTo(exitPos);
  if (!exitDir) {
    if (hauler.pos.x === 0)
      exitDir = LEFT;
    if (hauler.pos.y === 0)
      exitDir = TOP;
    if (hauler.pos.x === 49)
      exitDir = RIGHT;
    if (hauler.pos.y === 49)
      exitDir = BOTTOM;
  }
  const awayFromExitDir = (exitDir + 4) % 8;
  console.log(`exit dir: ${exitDir}, reverse: ${awayFromExitDir}`);

  switch (exitState) {
    case 1:
      hauler.move(exitDir);
      hauler.memory.exitState = exitState + 1;
      break;
    case 2:
      hauler.move(hauler);
      hauler.memory.exitState = exitState + 1;
      break;
    case 3:
      hauler.move(harvester);
      hauler.memory.exitState = exitState + 1;
      break;
    case 4:
      hauler.move(exitDir);
      hauler.memory.exitState = exitState + 1;
      break;
    case 5:
      hauler.move(awayFromExitDir);
      hauler.memory.exitState = exitState + 1;
      break;
    case 6:
      hauler.move(awayFromExitDir);
      hauler.memory.exitState = exitState + 1;
      break;

    default:
      hauler.memory.exitState = 0;
      break;
  }
}
