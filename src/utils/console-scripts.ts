import { Watchable } from "creep-utils";
import { isBoolean } from "lodash";
import { RoadPlan } from "planning/road-plan";
import { CostMatrixUtils } from "./cost-matrix-utils";
import { Stats } from "planning/stats";
import { MemoryUtils } from "planning/memory-utils";
import { SpawnUtils } from "control/spawn-utils";

global.spotCreeps = (...creeps: Creep[]) => {
  creeps.forEach(c => (c.memory.draw = true));
};

global.unspotCreeps = (...creeps: Creep[]) => {
  creeps.forEach(c => (c.memory.draw = false));
};

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
  const matrix = CostMatrixUtils.getInstance().roadPlanningRoomCallback(roomName);
  if (!isBoolean(matrix)) {
    for (let i = 0; i < 50; i++) {
      for (let j = 0; j < 50; j++) {
        const cost = matrix.get(i, j);
        room.visual.text(String(cost), i, j);
      }
    }
  }
};

global.drawRoadPlan = (origin: RoomPosition, goal: RoomPosition, range: number): void => {
  const room = Game.rooms[origin.roomName];
  const path = new RoadPlan(room).planRoad(origin, goal, range);
  room.visual.poly(path.path);
};

global.Stats = Stats;
global.MemoryUtils = MemoryUtils;
global.SpawnUtils = SpawnUtils;
