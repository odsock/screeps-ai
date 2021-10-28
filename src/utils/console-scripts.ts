import { Watchable } from "creep-utils";
import { isBoolean } from "lodash";
import { CostMatrixUtils } from "./cost-matrix-utils";

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

global.drawCostMatrix = (roomName: string): void => {
  const room = Game.rooms[roomName];
  const matrix = CostMatrixUtils.roadPlanningRoomCallback(roomName);
  if (!isBoolean(matrix)) {
    for (let i = 0; i < 50; i++) {
      for (let j = 0; j < 50; j++) {
        const cost = matrix.get(i, j);
        room.visual.text(String(cost), i, j);
      }
    }
  }
}
