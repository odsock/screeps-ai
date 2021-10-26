import { Sockpuppet } from "sockpuppet";
import { ErrorMapper } from "utils/ErrorMapper";
import { Logger } from "./logger";
import { SockPuppetConstants } from "./config/sockpuppet-constants";
import "./utils/console-scripts.js";
import * as Profiler from "../screeps-typescript-profiler";

global.sockpuppet = new Sockpuppet();

global.Profiler = Profiler.init();

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

  console.log(`<strong>Current game tick is ${Game.time}</strong>`);
  cleanupDeadCreepMemory();

  global.sockpuppet.run();

  const logger = new Logger();
  logger.run();

  Game.cpu.generatePixel();
});

// Automatically delete memory of missing creeps
function cleanupDeadCreepMemory() {
  for (const name in Memory.creeps) {
    if (!(name in Game.creeps)) {
      delete Memory.creeps[name];
    }
  }
}
