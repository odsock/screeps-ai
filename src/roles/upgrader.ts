import { CreepBodyProfile } from "./creep-wrapper";
import { CreepRole } from "config/creep-types";
import { CreepUtils } from "creep-utils";
import { Minder } from "./minder";

export class Upgrader extends Minder {
  public static readonly ROLE = CreepRole.UPGRADER;
  public static readonly BODY_PROFILE: CreepBodyProfile = {
    profile: [WORK],
    seed: [CARRY, WORK],
    maxBodyParts: 21
  };

  private myContainer: StructureContainer | undefined;

  public run(): void {
    if (this.atDestination()) {
      this.cancelHauler();
      this.buildRepairOrUpgrade();
    } else if (this.memory.replacing) {
      this.replaceCreep(this.memory.replacing);
    } else {
      this.moveToDestination();
    }
  }

  private buildRepairOrUpgrade(): void {
    if (this.buildNearbySite() !== ERR_NOT_FOUND) {
      if (this.store.energy < this.buildAmount * 2) {
        this.withdrawFromMyContainer();
      }
      return;
    }

    if (this.repairNearbySite() !== ERR_NOT_FOUND) {
      if (this.store.energy < this.repairCost * 2) {
        this.withdrawFromMyContainer();
      }
      return;
    }

    if (this.upgrade() !== ERR_NOT_FOUND) {
      if (this.store.energy < this.upgradeAmount) {
        this.withdrawFromMyContainer();
      }
      return;
    }

    CreepUtils.consoleLogIfWatched(this, `stumped. sitting like a lump`);
  }

  private replaceCreep(creepName: string) {
    const retiree = Game.creeps[creepName];
    if (retiree) {
      this.directHauler(retiree.pos, 1);
      this.retireCreep(retiree);
    } else {
      this.memory.replacing = undefined;
    }
  }

  /** Checks if on container or in range to source */
  // TODO consider roads and harvest positions in check
  private atDestination(): boolean {
    const container = this.getMyContainer();
    if (container && this.pos.isNearTo(container.pos)) {
      return true;
    }
    if (!container && this.room.controller && this.pos.inRangeTo(this.room.controller, 3)) {
      return true;
    }
    return false;
  }

  private getMyContainer(): StructureContainer | undefined {
    if (this.myContainer) {
      CreepUtils.consoleLogIfWatched(this, `found cached container`);
      return this.myContainer;
    }
    const containerFromMemory = this.resolveContainerIdFromMemory();
    if (containerFromMemory) {
      this.myContainer = containerFromMemory;
      CreepUtils.consoleLogIfWatched(this, `resolved container from memory`);
      return containerFromMemory;
    }
    CreepUtils.consoleLogIfWatched(this, `no controller container`);
    return undefined;
  }

  public moveToDestination(): ScreepsReturnCode {
    if (!this.room.controller) {
      return ERR_NO_PATH;
    }

    // move to claimed container if it exists
    const container = this.getMyContainer();
    if (container) {
      CreepUtils.consoleLogIfWatched(this, `finding path to controller container`);
      return this.directHauler(
        container.pos,
        1,
        this.costMatrixUtils.avoidHarvestPositionsAndRoadsNearControllerCostCallback
      );
    }

    // move to controller
    CreepUtils.consoleLogIfWatched(this, `finding path to controller`);
    return this.directHauler(
      this.room.controller.pos,
      3,
      this.costMatrixUtils.avoidHarvestPositionsAndRoadsNearControllerCostCallback
    );
  }

  protected withdrawFromMyContainer(): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `withdrawing`);
    let result: ScreepsReturnCode = ERR_NOT_FOUND;
    if (this.room.memory.controller.containerId) {
      const container = Game.getObjectById(this.room.memory.controller.containerId);
      if (container) {
        result = this.withdraw(container, RESOURCE_ENERGY);
      } else {
        CreepUtils.consoleLogIfWatched(this, `controller container id invalid`);
        this.room.memory.controller.containerId = undefined;
      }
    }
    CreepUtils.consoleLogIfWatched(this, `withdraw result`, result);
    return result;
  }
}
