import { Sockpuppet } from "sockpuppet";
import { ErrorMapper } from "utils/ErrorMapper";
import { Logger } from "./logger";
import {Constants} from "./constants";

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = ErrorMapper.wrapLoop(() => {
  // check version
  try {
    const version = process.env.npm_package_version;
    if (!Memory.version || Memory.version !== version) {
      Memory.version = version;
      console.log(Constants.BANNER_HEADER);
      console.log(Constants.BANNER_BODY);
      console.log(`Version: ${String(version)}`);
      console.log(Constants.BANNER_FOOTER);
    }
  } catch (error) {
    console.log(error);
  }

  console.log(`Current game tick is ${Game.time}`);
  cleanupDeadCreepMemory();

  const sockpuppet = new Sockpuppet();
  sockpuppet.run();

  const logger = new Logger();
  logger.run();
});

// Automatically delete memory of missing creeps
function cleanupDeadCreepMemory() {
  for (const name in Memory.creeps) {
    if (!(name in Game.creeps)) {
      delete Memory.creeps[name];
    }
  }
}
