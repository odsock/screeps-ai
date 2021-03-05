import { Sockpuppet } from "sockpuppet";
import { ErrorMapper } from "utils/ErrorMapper";
import { Logger } from "./logger";

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = ErrorMapper.wrapLoop(() => {
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
