import { CreepRole } from "config/creep-types";
import { CreepBodyProfile } from "./creep-body-utils";
import { Minder } from "./minder";
import { CreepUtils } from "creep-utils";
import { MemoryUtils } from "planning/memory-utils";
import { PlannerUtils } from "planning/planner-utils";

import { profile } from "../../screeps-typescript-profiler";

@profile
export class StoreMinder extends Minder {
  public static readonly ROLE = CreepRole.STORE_MINDER;
  public static readonly BODY_PROFILE: CreepBodyProfile = {
    profile: [CARRY],
    seed: [],
    maxBodyParts: 16
  };
  private readonly storage: StructureStorage | undefined;
  private readonly link: StructureLink | undefined;

  public constructor(creep: Creep) {
    super(creep);
    this.storage = this.roomw.storage;
    const linkId = this.roomw.memory.storage?.link?.id;
    if (linkId) {
      this.link = Game.getObjectById(linkId) ?? undefined;
    }
  }

  public run(): void {
    if (this.atDestination()) {
      this.cancelHauler();
      this.transferFromLinkToStorage();
    } else if (this.memory.replacing) {
      this.replaceCreep(this.memory.replacing);
    } else {
      this.moveToDestination();
    }
  }

  private transferFromLinkToStorage() {
    if (!this.link || !this.storage) {
      return;
    }
    if (this.link.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
      const withdrawResult = this.withdraw(this.link, RESOURCE_ENERGY);
      CreepUtils.consoleLogIfWatched(this, `withdraw from link`, withdrawResult);
      if (withdrawResult === OK) {
        const transferResult = this.transfer(this.storage, RESOURCE_ENERGY);
        CreepUtils.consoleLogIfWatched(this, `transfer to storage`, transferResult);
      }
    }
  }

  private atDestination(): boolean {
    if (!this.link || !this.storage) {
      return false;
    }
    return this.pos.isNearTo(this.link?.pos) && this.pos.isNearTo(this.storage?.pos);
  }

  public moveToDestination(): ScreepsReturnCode {
    if (!this.link || !this.storage) {
      return ERR_INVALID_TARGET;
    }
    const destinations = this.roomw
      .findCommonAdjacentPositions(this.link?.pos, this.storage?.pos)
      .filter(pos => PlannerUtils.isEnterable(pos))
      .sort((a, b) => this.pos.getRangeTo(a) - this.pos.getRangeTo(b));
    if (destinations.length > 0) {
      const result = this.directHauler(destinations[0]);
      CreepUtils.consoleLogIfWatched(this, `direct hauler to ${MemoryUtils.packRoomPosition(destinations[0])}`, result);
      return result;
    }
    return ERR_NO_PATH;
  }
}
