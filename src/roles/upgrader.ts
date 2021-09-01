import { CreepRole } from "config/creep-types";
import { CreepUtils } from "creep-utils";
import { Minder } from "./minder";

export class Upgrader extends Minder {
  public static readonly ROLE = CreepRole.UPGRADER;
  public static readonly BODY_PROFILE: CreepBodyProfile = {
    profile: [WORK],
    seed: [MOVE, CARRY],
    maxBodyParts: 10
  };

  protected claimContainer(): ScreepsReturnCode {
    const result = this.claimFreeControllerContainerAsMinder();
    CreepUtils.consoleLogIfWatched(this, `claim controller container`, result);
    return result;
  }
}
