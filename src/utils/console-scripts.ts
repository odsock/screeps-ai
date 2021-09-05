import { SockPuppetConstants } from "config/sockpuppet-constants";

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

global.placeExt = (pos: RoomPosition, structure: StructureConstant) => {
  const result = Game.rooms[pos.roomName].createConstructionSite(pos, structure);
  console.log(Game.rooms[pos.roomName], `place ${String(pos)} ${structure}`, result);
};

global.getPositionSpiral = (centerPos: RoomPosition, maxRange: number): void => {
  const line: RoomPosition[] = [];
  let x = 0;
  let y = 0;
  let dx = 0;
  let dy = -1;
  let pos: RoomPosition;

  for (let i = 0; i < Math.pow(maxRange * 2 + 1, 2); i++) {
    if (
      centerPos.x + x < SockPuppetConstants.ROOM_SIZE - 2 &&
      centerPos.x + x > 1 &&
      centerPos.y + y < SockPuppetConstants.ROOM_SIZE - 2 &&
      centerPos.y + y > 1
    ) {
      pos = new RoomPosition(centerPos.x + x, centerPos.y + y, centerPos.roomName);
      line.push(pos);
    }

    if (x === y || (x === -y && x < 0) || (x === 1 - y && x > 0)) {
      const temp = dx;
      dx = -dy;
      dy = temp;
    }

    x = x + dx;
    y = y + dy;
  }
  Game.rooms[centerPos.roomName].visual.poly(line, { stroke: "#0000FF" });
};
