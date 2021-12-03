import { CreepRole } from "config/creep-types";
import { CreepUtils } from "creep-utils";
import { profile } from "../../screeps-typescript-profiler";
import { CreepBodyProfile } from "./creep-wrapper";
import { Minder } from "./minder";

@profile
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
    maxBodyParts: 6
  };

  private myContainer: StructureContainer | undefined;
  private mySource: Source | undefined;

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
    const container = this.getMyContainer();
    if (container) {
      CreepUtils.consoleLogIfWatched(this, `finding path to source container`);
      return this.directHauler(container.pos);
    }

    // move to chosen source if no container claim
    const source = this.getMySource();
    if (source) {
      CreepUtils.consoleLogIfWatched(this, `finding path to source`);
      return this.directHauler(source.pos, 1);
    }

    // nowhere to move
    CreepUtils.consoleLogIfWatched(this, `stumped. no source to harvest.`);
    return ERR_INVALID_TARGET;
  }

  /** get container from my memory or claim one*/
  protected getMyContainer(): StructureContainer | undefined {
    if (this.myContainer) {
      return this.myContainer;
    }

    const containerFromMemory = this.resolveContainerIdFromMemory();
    if (containerFromMemory) {
      this.myContainer = containerFromMemory;
      return containerFromMemory;
    }

    const source = this.getMySource();
    if (source) {
      const sourceInfo = Memory.rooms[this.memory.targetRoom].sources[source.id];
      if (!sourceInfo) {
        CreepUtils.consoleLogIfWatched(this, `no source memory for id: ${source.id}`);
        return undefined;
      }

      const claimedContainer = this.claimContainerAtSource(sourceInfo);
      if (claimedContainer) {
        this.myContainer = claimedContainer;
        return claimedContainer;
      }
    }

    CreepUtils.consoleLogIfWatched(this, `no free source container`);
    return undefined;
  }

  /** set id's for minder and container if not already claimed */
  private claimContainerAtSource(sourceInfo: SourceInfo) {
    if (sourceInfo.containerId && (!sourceInfo.minderId || sourceInfo.minderId === this.id)) {
      const container = Game.getObjectById(sourceInfo.containerId);
      if (container) {
        sourceInfo.minderId = this.id;
        this.memory.containerId = sourceInfo.containerId;
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
