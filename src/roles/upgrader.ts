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
      CreepUtils.consoleLogIfWatched(this, `at destination`);
      this.cancelHauler();
      this.buildRepairOrUpgrade();
    } else if (this.memory.replacing) {
      CreepUtils.consoleLogIfWatched(this, `replacing creep`);
      this.replaceCreep(this.memory.replacing);
    } else {
      CreepUtils.consoleLogIfWatched(this, `moving to destination`);
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

  /** Checks if at a position in list of room's upgrader positions */
  private atDestination(): boolean {
    const upgraderPositions = this.roomw.getUpgradePositions();
    return !!_.find(upgraderPositions, upgraderPosition => this.pos.isEqualTo(upgraderPosition));
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
    const upgraderPositions = this.roomw.getUpgradePositions();
    const availablePositions = upgraderPositions.filter(
      pos => _.filter(pos.lookFor(LOOK_CREEPS), c => c.memory.role === CreepRole.UPGRADER).length === 0
    );

    if (availablePositions.length > 0) {
      CreepUtils.consoleLogIfWatched(
        this,
        `finding path to upgrade position: ${availablePositions[0].x},${availablePositions[0].y}`
      );
      return this.directHauler(availablePositions[0]);
    }
    return ERR_NOT_FOUND;
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
