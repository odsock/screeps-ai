import { CreepBodyProfile } from "./creep-wrapper";
import { CreepRole } from "config/creep-types";
import { CreepUtils } from "creep-utils";
import { Minder } from "./minder";
import { profile } from "../../screeps-typescript-profiler";

@profile
export class Harvester extends Minder {
  public static ROLE: CreepRole = CreepRole.HARVESTER;
  public static BODY_PROFILE: CreepBodyProfile = {
    profile: [WORK],
    seed: [],
    maxBodyParts: 5
  };

  public run(): void {
    // retire old creep if valid retiree set
    if (this.memory.replacing) {
      const retiree = Game.creeps[this.memory.replacing];
      if (retiree) {
        this.directHauler(retiree.pos, { range: 1 });
        this.retireCreep(retiree);
        return;
      } else {
        this.memory.replacing = undefined;
      }
    }

    // move to harvest position
    this.moveToDestination();

    // harvest if possible
    if (this.harvestFromNearbySource() === OK) {
      return;
    }

    CreepUtils.consoleLogIfWatched(this, `stumped. sitting like a lump`);
  }

  public moveToDestination(): ScreepsReturnCode {
    // move to claimed container if it exists
    const container = this.getMyContainer();
    if (container) {
      CreepUtils.consoleLogIfWatched(this, `finding path to source container`);
      return this.directHauler(container.pos, {});
    }

    // move to chosen source if no container claim
    const source = this.getMySource();
    if (source) {
      CreepUtils.consoleLogIfWatched(this, `finding path to source`);
      return this.directHauler(source.pos, { range: 1 });
    }

    // nowhere to move
    CreepUtils.consoleLogIfWatched(this, `stumped. no source to harvest.`);
    return ERR_INVALID_TARGET;
  }

  private directHauler(target: RoomPosition, findPathOpts: FindPathOpts): ScreepsReturnCode {
    // cancel hauler call if at target
    const myPathToTarget = this.pos.findPathTo(target, findPathOpts);
    if (myPathToTarget.length === 0) {
      this.cancelHauler();
      return OK;
    }

    // call a hauler if not at target yet
    CreepUtils.consoleLogIfWatched(this, `calling hauler for path`);
    this.callHauler();

    // if we have a hauler, tell it where to go
    if (this.memory.haulerName) {
      const hauler = Game.creeps[this.memory.haulerName];
      if (hauler) {
        CreepUtils.consoleLogIfWatched(this, `already have a hauler`);
        // setup hauler pulling
        const pullResult = hauler.pull(this);
        const moveResult = this.move(hauler);
        if (pullResult === OK && moveResult === OK) {
          // get haulers path to target
          const haulerPathToTarget = hauler.pos.findPathTo(target, findPathOpts);

          // if path is 0 steps, hauler is at target, so swap positions
          if (haulerPathToTarget.length === 0) {
            const result = hauler.moveTo(this);
            CreepUtils.consoleLogIfWatched(this, `haul last step`, result);
            return result;
          }

          // move hauler along the path
          const haulResult = hauler.moveByPath(haulerPathToTarget);
          CreepUtils.consoleLogIfWatched(this, `haul`, haulResult);
        } else {
          CreepUtils.consoleLogIfWatched(this, `failed to pull. pull ${pullResult}, move ${moveResult}`);
          return ERR_INVALID_ARGS;
        }
      } else {
        this.cancelHauler();
        return ERR_INVALID_TARGET;
      }
    }
    return OK;
  }

  /** get container from my memory or claim one*/
  protected getMyContainer(): StructureContainer | undefined {
    const containerFromMemory = this.resolveContainerIdFromMemory();
    if (containerFromMemory) {
      return containerFromMemory;
    }

    if (!this.memory.source) {
      CreepUtils.consoleLogIfWatched(this, `no source selected for harvest`);
      return undefined;
    }

    const sourceInfo = this.roomw.memory.sources[this.memory.source];
    if (!sourceInfo) {
      CreepUtils.consoleLogIfWatched(this, `no source memory for id: ${this.memory.source}`);
      return undefined;
    }

    const claimedContainer = this.claimContainerAtSource(sourceInfo);
    if (claimedContainer) {
      return claimedContainer;
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

  /** get container object for id in memory, clear memory if not valid */
  private resolveContainerIdFromMemory() {
    if (this.memory.containerId) {
      const container = Game.getObjectById(this.memory.containerId);
      if (container) {
        return container;
      }
      CreepUtils.consoleLogIfWatched(this, `container id invalid: ${this.memory.containerId}`);
      this.memory.containerId = undefined;
    }
    return undefined;
  }

  private getMySource(): Source | undefined {
    let mySourceId = this.memory.source;
    if (!mySourceId) {
      mySourceId = this.findShortHandedSourceInTargetRoom();
      this.memory.source = mySourceId;
    }
    return mySourceId ? Game.getObjectById(mySourceId) ?? undefined : undefined;
  }
}
