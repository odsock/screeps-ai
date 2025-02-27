import "core-js/actual/array/to-sorted";
import { Sockpuppet } from "sockpuppet";
import { ErrorMapper } from "utils/ErrorMapper";
import { SockPuppetConstants } from "./config/sockpuppet-constants";
import "./utils/console-scripts.js";
import { MemoryUtils } from "planning/memory-utils";
import { Stats } from "planning/stats";
import * as Profiler from "../screeps-typescript-profiler";
import { LogLevel } from "creep-utils";

// mem hack
if (global.memory) {
  delete global.Memory;
  global.Memory = global.memory;
} else {
  global.memory = Memory;
}

global.sockpuppet = new Sockpuppet();

global.Profiler = Profiler.init();
global.LOG_LEVEL = LogLevel.INFO;
MemoryUtils.setCache(SockPuppetConstants.START_TICK, Game.time, -1);

recordUsername();

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = ErrorMapper.wrapLoop(() => {
  // check version
  try {
    const version = process.env.npm_package_version;
    if (!Memory.version || Memory.version !== version) {
      Memory.version = version;
      console.log(SockPuppetConstants.BANNER_HEADER);
      console.log(SockPuppetConstants.BANNER_BODY);
      console.log(`Version: ${String(version)}`);
      console.log(SockPuppetConstants.BANNER_FOOTER);
    }
  } catch (error) {
    console.log(error);
  }

  console.log();
  console.log(`<strong>Current game tick is ${Game.time}</strong>`);
  cleanupDeadCreepMemory();

  global.sockpuppet.run();

  if (Game.shard.name === "shard3" && Game.cpu.bucket >= PIXEL_CPU_COST) {
    Game.cpu.generatePixel();
  }

  // must be last thing in loop to keep cpu calc accurate
  new Stats().showStats();
  // write out memory from mem hack cache
  RawMemory.set(JSON.stringify(Memory));
});

function recordUsername(): void {
  if (!Memory.username) {
    const spawn = _.find(Game.spawns, () => true);
    if (spawn) {
      Memory.username = spawn.owner.username;
    }
  }
}

// Automatically delete memory of missing creeps
function cleanupDeadCreepMemory(): void {
  for (const name in Memory.creeps) {
    if (!(name in Game.creeps)) {
      delete Memory.creeps[name];
    }
  }
}
