import { CreepRole } from "config/creep-types";
import { CreepUtils } from "creep-utils";
import { Minder } from "./minder";

export class Harvester extends Minder {
  public static ROLE: CreepRole = CreepRole.HARVESTER;
  public static BODY_PROFILE: CreepBodyProfile = {
    profile: [WORK],
    seed: [],
    maxBodyParts: 5
  };

  protected claimContainer(): ScreepsReturnCode {
    const result = this.claimFreeSourceContainerAsMinder();
    CreepUtils.consoleLogIfWatched(this, `claim source container`, result);
    return result;
  }
}
