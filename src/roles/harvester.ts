import { CreepUtils } from "creep-utils";
import { Minder } from "./minder";

export class Harvester extends Minder {
  public run() {
    super.run();

    if(!this.getMyContainer()) {
      this.claimFreeSourceContainer();
    }

    if(!this.onMyContainer) {
      this.moveToMyContainer();
    }
    
    if(this.fillContainer() != ERR_NOT_IN_RANGE) {
      return;
    }

    CreepUtils.consoleLogIfWatched(this, `stumped. sitting like a lump`);
  }
}
