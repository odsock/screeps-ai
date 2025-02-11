import { LogLevel, Watchable } from "creep-utils";
import { isBoolean } from "lodash";
import { CostMatrixUtils } from "./cost-matrix-utils";
import { MemoryUtils } from "planning/memory-utils";
import { RoomWrapper } from "structures/room-wrapper";
import { StructurePlanPosition } from "planning/structure-plan";

global.spotCreeps = (...creeps: Creep[]): void => {
  creeps.forEach(c => (c.memory.draw = true));
};

global.unspotCreeps = (...creeps: Creep[]): void => {
  creeps.forEach(c => (c.memory.draw = false));
};

global.watch = (key: string): void => {
  const watchable: Watchable = getWatchable(key);
  if (watchable) {
    watchable.memory.watched = true;
  }
};

global.unwatch = (key: string): void => {
  const watchable: Watchable = getWatchable(key);
  if (watchable) {
    watchable.memory.watched = false;
  }
};

function getWatchable(key: string): Watchable {
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

global.getRoomWrapper = (roomName: string): RoomWrapper => {
  return RoomWrapper.getInstance(roomName);
};

global.printRoomPlan = (roomName: string): void => {
  const plan = MemoryUtils.getCache<StructurePlanPosition[]>(`${roomName}_plan`);
  let planPrint = `Room Plan: ${roomName}`;
  plan?.forEach(planPos => {
    const pos = MemoryUtils.packRoomPosition(planPos.pos);
    planPrint = planPrint.concat(`\n${pos}: ${planPos.structure}`);
  });
  console.log(planPrint);
};

global.MemoryUtils = MemoryUtils;

global.DEBUG = LogLevel.DEBUG;
global.INFO = LogLevel.INFO;
global.WARN = LogLevel.WARN;
global.ERROR = LogLevel.ERROR;
