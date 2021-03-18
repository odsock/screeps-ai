import { CreepUtils } from "creep-utils";
import { Minder } from "./minder";

export class Upgrader extends Minder {
  public run() {
    super.run();

    if(!this.getMyContainer()) {
      if(this.claimFreeControllerContainer() == ERR_NOT_FOUND) {
        return;
      }
    }

    if(!this.onMyContainer) {
      if(this.moveToMyContainer() == ERR_NOT_FOUND) {
        return;
      }
    }

    if (this.withdrawAndUpgrade() != ERR_NOT_FOUND) {
      return;
    }

    CreepUtils.consoleLogIfWatched(this, `stumped. sitting like a lump`);
  }
}
