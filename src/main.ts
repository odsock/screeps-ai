import { Sockpuppet } from "sockpuppet";
import { ErrorMapper } from "utils/ErrorMapper";
import { Logger } from "./logger";
import { SockPuppetConstants } from "./config/sockpuppet-constants";
import "./utils/console-scripts.js";
import { MemoryUtils } from "planning/memory-utils";

global.sockpuppet = new Sockpuppet();

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = ErrorMapper.wrapLoop(() => {
  const cpu = Game.cpu.getUsed();
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

  console.log(`Current game tick is ${Game.time}`);
  cleanupDeadCreepMemory();

  MemoryUtils.writeCacheToMemory();

  global.sockpuppet.run();

  const logger = new Logger();
  logger.run();
  const cpuUsed = Game.cpu.getUsed() - cpu;
  console.log(`CPU tick total: ${cpuUsed}`);
  Memory.cpu.tickTotal = Memory.cpu.tickTotal ?? [];
  const tickTotal = Memory.cpu.tickTotal;
  tickTotal.push(cpuUsed);
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
