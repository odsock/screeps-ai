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
