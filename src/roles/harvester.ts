import { CreepRole } from "config/creep-types";
import { CreepUtils } from "creep-utils";
import { MemoryUtils } from "planning/memory-utils";

import { CreepBodyProfile } from "./creep-wrapper";
import { Minder } from "./minder";

export class Harvester extends Minder {
  public static ROLE: CreepRole = CreepRole.HARVESTER;
  public static BODY_PROFILE: CreepBodyProfile = {
    profile: [WORK],
    seed: [],
    maxBodyParts: 5
  };

  public static BODY_PROFILE_REMOTE: CreepBodyProfile = {
    profile: [WORK],
    seed: [CARRY],
    maxBodyParts: 7
  };

  private mySource: Source | undefined;
  private myContainer: StructureContainer | undefined;

  public run(): void {
    if (this.atDestination()) {
      this.cancelHauler();
      const result = this.buildOrRepairMyContainer();
      if (result === ERR_NO_BODYPART || result === ERR_NOT_ENOUGH_ENERGY || result === ERR_INVALID_TARGET) {
        this.harvestFromNearbySource();
      }
    } else if (this.memory.replacing) {
      this.replaceCreep(this.memory.replacing);
    } else {
      this.moveToDestination();
    }
  }

  private buildOrRepairMyContainer(): ScreepsReturnCode {
    if (this.getActiveBodyparts(CARRY) === 0 || this.getActiveBodyparts(WORK) === 0) {
      return ERR_NO_BODYPART;
    }
    const source = this.getMySource();
    const container = this.getMyContainer();
    if (container && container.hits < container.hitsMax) {
      if (this.store.energy < this.repairCost) {
        return ERR_NOT_ENOUGH_ENERGY;
      }
      const result = this.repair(container);
      CreepUtils.consoleLogIfWatched(this, `repair container`, result);
      return result;
    } else if (source) {
      const constructionSiteId = Memory.rooms[source.room.name]?.sources[source.id]?.containerConstructionSiteId;
      if (constructionSiteId) {
        const site = Game.getObjectById<ConstructionSite<BuildableStructureConstant>>(constructionSiteId);
        if (site) {
          if (this.store.energy < this.buildAmount) {
            return ERR_NOT_ENOUGH_ENERGY;
          }
          const result = this.build(site);
          CreepUtils.consoleLogIfWatched(this, `build container`, result);
          return result;
        }
      }
    }
    return ERR_INVALID_TARGET;
  }

  protected replaceCreep(creepName: string): void {
    const retiree = Game.creeps[creepName];
    if (retiree) {
      this.directHauler(retiree.pos, 1);
      this.retireCreep(retiree);
    } else {
      this.memory.replacing = undefined;
    }
  }

  /** Checks if on container or in range to source */
  protected atDestination(): boolean {
    const container = this.getMyContainer();
    if (container && this.pos.isEqualTo(container.pos)) {
      return true;
    }
    const source = this.getMySource();
    if (!container && source && this.pos.inRangeTo(source.pos, 1)) {
      return true;
    }
    return false;
  }

  public moveToDestination(): ScreepsReturnCode {
    // move to claimed container if it exists
    const containerPos = this.getMyContainerPosition();
    if (containerPos) {
      CreepUtils.consoleLogIfWatched(this, `finding path to source container`);
      return this.directHauler(containerPos);
    }

    // move to chosen source if no container claim
    const sourcePos = this.getMySourcePosition();
    if (sourcePos) {
      CreepUtils.consoleLogIfWatched(this, `finding path to source`);
      return this.directHauler(sourcePos, 1);
    }

    // nowhere to move
    CreepUtils.consoleLogIfWatched(this, `stumped. no source to harvest.`);
    return ERR_INVALID_TARGET;
  }

  protected getMyContainerPosition(): RoomPosition | undefined {
    const container = this.getMyContainer();
    if (container) {
      CreepUtils.consoleLogIfWatched(this, `found container position`);
      return container.pos;
    }

    return undefined;
  }

  protected getMySourcePosition(): RoomPosition | undefined {
    const source = this.getMySource();
    if (source) {
      return source.pos;
    }

    const sourceId = this.memory.source;
    const targetRoom = this.memory.targetRoom;
    if (sourceId) {
      const posString = Memory.rooms[targetRoom].sources[sourceId].pos;
      if (posString) {
        return MemoryUtils.unpackRoomPosition(posString);
      }
    }
    return undefined;
  }

  /** get container from my source or claim one*/
  protected getMyContainer(): StructureContainer | undefined {
    if (this.myContainer) {
      CreepUtils.consoleLogIfWatched(this, `found cached container reference`);
      return this.myContainer;
    }
    const source = this.getMySource();
    if (source) {
      const sourceInfo = Memory.rooms[this.memory.targetRoom].sources[source.id];
      if (!sourceInfo) {
        CreepUtils.consoleLogIfWatched(this, `no source memory for id: ${source.id}`);
        return undefined;
      }

      if (sourceInfo.minderId === this.id && sourceInfo.containerId) {
        const container = Game.getObjectById(sourceInfo.containerId);
        if (container) {
          CreepUtils.consoleLogIfWatched(this, `setting cached container reference`);
          this.myContainer = container;
          return container;
        }
      }

      const claimedContainer = this.claimContainerAtSource(sourceInfo);
      if (claimedContainer) {
        CreepUtils.consoleLogIfWatched(this, `claimed container`);
        this.myContainer = claimedContainer;
        return claimedContainer;
      }
    }

    CreepUtils.consoleLogIfWatched(this, `no free source container`);
    return undefined;
  }

  /** set id's for minder and container if not already claimed */
  private claimContainerAtSource(sourceInfo: SourceInfo) {
    if (
      sourceInfo.containerId &&
      (!sourceInfo.minderId ||
        sourceInfo.minderId === this.id ||
        MemoryUtils.unpackRoomPosition(sourceInfo.containerPos ?? "0,0").isEqualTo(this.pos.x, this.pos.y))
    ) {
      const container = Game.getObjectById(sourceInfo.containerId);
      if (container) {
        sourceInfo.minderId = this.id;
        CreepUtils.consoleLogIfWatched(this, `claimed source container: ${sourceInfo.containerId}`);
        return container;
      }
      CreepUtils.consoleLogIfWatched(this, `container id invalid`);
    }
    return undefined;
  }

  private getMySource(): Source | undefined {
    if (this.mySource) {
      return this.mySource;
    }
    if (!this.memory.source) {
      CreepUtils.consoleLogIfWatched(this, `no source selected for harvest`);
      return undefined;
    }
    return this.memory.source ? Game.getObjectById(this.memory.source) ?? undefined : undefined;
  }
}
