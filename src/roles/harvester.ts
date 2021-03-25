import { Minder } from "./minder";
import { CreepUtils } from "creep-utils";

export class Harvester extends Minder {
  public run(): void {
    super.run();

    if (!this.getMyContainer()) {
      this.claimFreeSourceContainer();
    }

    if (!this.onMyContainer) {
      this.moveToMyContainer();
    }

    if (this.fillContainer() !== ERR_NOT_IN_RANGE) {
      return;
    }

    CreepUtils.consoleLogIfWatched(this, `stumped. sitting like a lump`);
  }
}
