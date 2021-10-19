import { Watchable } from "creep-utils";
import { MemoryUtils } from "planning/memory-utils";
import { RoomWrapper } from "structures/room-wrapper";

global.watch = (key: string) => {
  const watchable: Watchable = getWatchable(key);
  if (watchable) {
    watchable.memory.watched = true;
  }
};

global.unwatch = (key: string) => {
  const watchable: Watchable = getWatchable(key);
  if (watchable) {
    watchable.memory.watched = false;
  }
};

function getWatchable(key: string) {
  let watchable: Watchable;
  if (Game.rooms[key]) {
    watchable = Game.rooms[key];
  } else if (Game.creeps[key]) {
    watchable = Game.creeps[key] as Watchable;
  } else if (Game.spawns[key]) {
    watchable = Game.spawns[key] as Watchable;
  } else {
    watchable = Game.getObjectById(key as Id<Creep | Structure>) as Watchable;
  }
  return watchable;
}

global.testGetRoomWrapper = (roomArg: string | Room) => {
  const name = roomArg instanceof Room ? roomArg.name : roomArg;
  const room = roomArg instanceof Room ? roomArg : Game.rooms[name];
  if (room) {
    console.log(`mock get room wrapper...`);
  }
  throw new Error(`ERROR: invalid room name ${name}`);
};
