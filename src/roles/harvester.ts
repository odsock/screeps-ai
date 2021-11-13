import { CreepRole } from "config/creep-types";
import { SockPuppetConstants } from "config/sockpuppet-constants";
import { CreepUtils } from "creep-utils";
import { MemoryUtils } from "planning/memory-utils";
import { profile } from "../../screeps-typescript-profiler";
import { CreepBodyProfile } from "./creep-wrapper";
import { Hauler } from "./hauler";
import { Minder } from "./minder";

declare global {
  interface CreepMemory {
    exitState?: ExitState;
  }
}

export enum ExitState {
  START_EXIT,
  HAULER_MOVED,
  HAULER_WAITING,
  HAUL
}

@profile
export class Harvester extends Minder {
  public static ROLE: CreepRole = CreepRole.HARVESTER;
  public static BODY_PROFILE: CreepBodyProfile = {
    profile: [WORK],
    seed: [],
    maxBodyParts: 5
  };

  private myContainer: StructureContainer | undefined;
  private mySource: Source | undefined;
  private myHauler: Hauler | undefined;

  public run(): void {
    if (this.atDestination()) {
      this.cancelHauler();
      this.harvestFromNearbySource();
    } else if (this.memory.replacing) {
      this.replaceCreep(this.memory.replacing);
    } else {
      this.moveToDestination();
    }
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
  private atDestination(): boolean {
    const container = this.getMyContainer();
    if (container && this.pos.isEqualTo(container.pos)) {
      return true;
    }
    const source = this.getMySource();
    if (source && this.pos.inRangeTo(source.pos, 1)) {
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

  private directHauler(target: RoomPosition, range = 0): ScreepsReturnCode {
    // TODO might need to move this to harvest method
    if (this.pos.inRangeTo(target, range)) {
      this.cancelHauler();
      return OK;
    }

    const hauler = this.getHauler();
    if (!hauler) {
      CreepUtils.consoleLogIfWatched(this, `calling hauler for path`);
      this.callHauler();
      return ERR_NOT_FOUND;
    }

    console.log(
      `DEBUG: ${String(this.memory.exitState)}`,
      this.memory.exitState !== undefined,
      this.memory.exitState !== ExitState.HAUL
    );
    if (this.memory.exitState !== undefined && this.memory.exitState !== ExitState.HAUL) {
      console.log(`WTF`);
      this.handleRoomExit(hauler);
    }

    // setup hauler pulling
    const pullResult = hauler.pull(this);
    const moveResult = this.move(hauler);
    if (pullResult === OK && moveResult === OK) {
      // get haulers path to target
      const haulerPathToTarget = hauler.pos.findPathTo(target, { range });

      // if path is 0 steps, hauler is at target or exit of a room, so swap positions
      if (haulerPathToTarget.length === 0) {
        const result = hauler.moveToW(this);
        CreepUtils.consoleLogIfWatched(this, `swap with hauler`, result);
        if (this.atRoomExit()) {
          this.memory.exitState = ExitState.START_EXIT;
        }
        return result;
      }

      // move hauler along the path
      const haulResult = hauler.moveByPath(haulerPathToTarget);
      CreepUtils.consoleLogIfWatched(this, `haul`, haulResult);
    } else {
      CreepUtils.consoleLogIfWatched(this, `failed to pull. pull ${pullResult}, move ${moveResult}`);
      return ERR_INVALID_ARGS;
    }
    return OK;
  }

  private handleRoomExit(hauler: Hauler): ScreepsReturnCode {
    console.log(`WTF`);
    CreepUtils.consoleLogIfWatched(this, `handle room exit ${String(this.memory.exitState)}`);
    switch (this.memory.exitState) {
      case ExitState.START_EXIT:
        // hauler was at exit last tick, and should have phased through, pulling cargo along
        // hauler should step away from exit, and wait for cargo to phase through
        if (this.memory.lastPos) {
          const lastPos = MemoryUtils.unpackRoomPosition(this.memory.lastPos);
          const returnDirection = hauler.roomw.findExitTo(lastPos.roomName);
          if (returnDirection === ERR_NO_PATH || returnDirection === ERR_INVALID_ARGS) {
            return returnDirection;
          }
          const directionAwayFromExit = (returnDirection + (4 % 8)) as DirectionConstant;
          hauler.move(directionAwayFromExit);
          this.memory.exitState = ExitState.HAULER_MOVED;
        }
        break;
      // hauler has stepped away from exit, and needs to wait one tick
      case ExitState.HAULER_MOVED:
        this.memory.exitState = ExitState.HAULER_WAITING;
        break;
      // hauler waiting one tick
      case ExitState.HAULER_WAITING:
        this.memory.exitState = ExitState.HAUL;
        break;
      // hauler ready to haul cargo away from exit
      case ExitState.HAUL:
        this.memory.exitState = ExitState.HAUL;
        break;
      // shouldn't reach this, but handled for compiler
      case undefined:
        return ERR_INVALID_ARGS;

      default:
        assertNever(this.memory.exitState);
    }

    function assertNever(x: never): never {
      throw new Error("Missing enum case: " + JSON.stringify(x));
    }
    return ERR_INVALID_ARGS;
  }

  /** checks that hauler and harvester are swapping positions at exit tile */
  private atRoomExit() {
    let atRoomExit = false;
    const hauler = this.getHauler();
    if (hauler) {
      const roomSizeMax = SockPuppetConstants.ROOM_SIZE - 1;
      if (
        (this.pos.x === 0 && hauler.pos.x === roomSizeMax) ||
        (this.pos.x === roomSizeMax && hauler.pos.x === 0) ||
        (this.pos.y === 0 && hauler.pos.y === roomSizeMax) ||
        (this.pos.y === roomSizeMax && hauler.pos.y === 0)
      ) {
        atRoomExit = true;
      }
    }
    console.log(`DEBUG: at room exit: ${String(atRoomExit)}`);
    return atRoomExit;
  }

  private getHauler(): Hauler | undefined {
    if (this.myHauler) {
      return this.myHauler;
    } else if (this.memory.haulerName) {
      const haulerCreep = Game.creeps[this.memory.haulerName];
      if (!haulerCreep) {
        CreepUtils.consoleLogIfWatched(this, `invalid hauler name`);
        delete this.memory.haulerName;
        return undefined;
      }
      this.myHauler = new Hauler(haulerCreep);
      CreepUtils.consoleLogIfWatched(this, `have a hauler`);
      return this.myHauler;
    }
    CreepUtils.consoleLogIfWatched(this, `no hauler`);
    return undefined;
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
