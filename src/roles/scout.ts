import { CreepRole } from "config/creep-types";
import { CreepUtils } from "creep-utils";
import { CreepBodyProfile } from "./creep-body-utils";
import { RemoteCreepWrapper } from "./remote-creep-wrapper";

import { profile } from "../../screeps-typescript-profiler";

@profile
export class Scout extends RemoteCreepWrapper {
  public static readonly ROLE = CreepRole.SCOUT;
  public static readonly BODY_PROFILE: CreepBodyProfile = {
    profile: [],
    seed: [MOVE],
    maxBodyParts: 1
  };

  public run(): void {
    const fleeResult = this.fleeIfHostiles();
    if (fleeResult !== ERR_NOT_FOUND) {
      return;
    }

    if (!this.memory.targetRoom) {
      CreepUtils.consoleLogIfWatched(this, `no room targeted. sitting like a lump.`);
      return;
    } else {
      const result = this.moveToRoom(this.memory.targetRoom);
      CreepUtils.consoleLogIfWatched(this, `move to target room`, result);
    }
  }
}
