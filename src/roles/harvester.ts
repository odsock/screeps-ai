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

  public static BODY_PROFILE_LINK: CreepBodyProfile = {
    profile: [WORK],
    seed: [CARRY],
    maxBodyParts: 6
  };

  private mySource: Source | undefined;
  private myContainer: StructureContainer | undefined;

  public run(): void {
    if (this.atDestination()) {
      this.cancelHauler();
      const buildResult = this.buildOrRepairMyContainer();
      if (
        buildResult === ERR_NO_BODYPART ||
        buildResult === ERR_NOT_ENOUGH_ENERGY ||
        buildResult === ERR_INVALID_TARGET
      ) {
        this.harvestFromMySource();
      }
      this.transferToLink();
    } else if (this.memory.replacing) {
      this.replaceCreep(this.memory.replacing);
    } else {
      this.moveToDestination();
    }
  }

  protected transferToLink(): ScreepsReturnCode {
    let result: ScreepsReturnCode = ERR_INVALID_TARGET;
    const link = this.getMyLink();
    if (link) {
      result = this.transferW(link, RESOURCE_ENERGY);
    }
    CreepUtils.consoleLogIfWatched(this, "transfer to link: ", result);
    return result;
  }

  protected getMyLink(): StructureLink | undefined {
    const source = this.getMySource();
    if (!source) {
      return undefined;
    }
    const linkId: Id<StructureLink> | undefined = this.roomw.memory.sources[source.id].link?.id;
    if (linkId) {
      return Game.getObjectById<StructureLink>(linkId) ?? undefined;
    }
    return undefined;
  }

  protected harvestFromMySource(): ScreepsReturnCode {
    const source = this.getMySource();
    if (source) {
      const result = this.harvestW(source);
      CreepUtils.consoleLogIfWatched(this, `harvest result`, result);
      return result;
    }
    return ERR_NOT_IN_RANGE;
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
      const constructionSiteId = Memory.rooms[source.room.name]?.sources[source.id]?.container?.constructionSiteId;
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

      if (sourceInfo.minderId === this.id && sourceInfo.container?.id) {
        const container = Game.getObjectById(sourceInfo.container?.id);
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
      sourceInfo.container?.id &&
      (!sourceInfo.minderId ||
        sourceInfo.minderId === this.id ||
        MemoryUtils.unpackRoomPosition(sourceInfo.container?.pos ?? "0,0").isEqualTo(this.pos.x, this.pos.y))
    ) {
      const container = Game.getObjectById(sourceInfo.container.id);
      if (container) {
        sourceInfo.minderId = this.id;
        CreepUtils.consoleLogIfWatched(this, `claimed source container: ${sourceInfo.container.id}`);
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
