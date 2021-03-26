import { Minder } from "./minder";
import { CreepUtils } from "creep-utils";

export class Upgrader extends Minder {
  public run(): void {
    super.run();

    if (!this.getMyContainer()) {
      if (this.claimFreeControllerContainer() === ERR_NOT_FOUND) {
        CreepUtils.consoleLogIfWatched(this, `couldn't find a box`);
        return;
      }
    }

    if (!this.onMyContainer) {
      if (this.moveToMyContainer() === ERR_NOT_FOUND) {
        CreepUtils.consoleLogIfWatched(this, `where'd my box go?`);
        return;
      }
    }

    if (this.withdrawAndUpgrade() === ERR_NOT_FOUND) {
      CreepUtils.consoleLogIfWatched(this, `upgrade what?`);
      return;
    }

    CreepUtils.consoleLogIfWatched(this, `stumped. sitting like a lump`);
  }
}
