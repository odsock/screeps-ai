import { Sockpuppet } from "sockpuppet";
import { ErrorMapper } from "utils/ErrorMapper";
import { Logger } from "./logger";
import { SockPuppetConstants } from "./config/sockpuppet-constants";
import "./utils/console-scripts.js";
import { CreepUtils } from "creep-utils";
import * as Profiler from "../screeps-typescript-profiler";

global.sockpuppet = new Sockpuppet();

global.Profiler = Profiler.init();

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = ErrorMapper.wrapLoop(() => {
  const cpuBefore = Game.cpu.getUsed();
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
  CreepUtils.profile(global.sockpuppet, `version check`, cpuBefore);

  console.log(`<strong>Current game tick is ${Game.time}</strong>`);
  let cpu = Game.cpu.getUsed();
  cleanupDeadCreepMemory();
  CreepUtils.profile(global.sockpuppet, `cleanup dead creeps`, cpu);

  cpu = Game.cpu.getUsed();
  global.sockpuppet.run();
  CreepUtils.profile(global.sockpuppet, `run sockpuppet`, cpu);

  cpu = Game.cpu.getUsed();
  const logger = new Logger();
  logger.run();
  CreepUtils.profile(global.sockpuppet, `logger`, cpu);

  const cpuAfter = Game.cpu.getUsed();
  CreepUtils.profile(global.sockpuppet, `CPU tick total`, cpuBefore);
  Memory.cpu.tickTotal = Memory.cpu.tickTotal ?? [];
  const tickTotal = Memory.cpu.tickTotal;
  tickTotal.push(cpuAfter - cpuBefore);
  if (tickTotal.length > CREEP_LIFE_TIME) {
    tickTotal.shift();
  }
});

// Automatically delete memory of missing creeps
function cleanupDeadCreepMemory() {
  for (const name in Memory.creeps) {
    if (!(name in Game.creeps)) {
      delete Memory.creeps[name];
    }
  }
}
