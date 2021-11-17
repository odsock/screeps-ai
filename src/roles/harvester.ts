import { CreepRole } from "config/creep-types";
import { CreepUtils } from "creep-utils";
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
  NOT_EXITING,
  AT_EDGE,
  WAITING,
  SWAPPING,
  EXITING,
  LEAVE_EDGE,
  PULL
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

    // get haulers path to target
    const haulerPathToTarget = hauler.pos.findPathTo(target, { range });

    // path length 1 means near target, or leaving room
    if (!hauler.memory.exitState && haulerPathToTarget.length === 1 && hauler.room.name !== target.roomName) {
      hauler.memory.exitState = ExitState.AT_EDGE;
    }

    if (hauler.memory.exitState !== ExitState.NOT_EXITING) {
      const exitResult = this.handleRoomExit(hauler);
      return exitResult;
    }

    // setup hauler pulling
    const pullResult = hauler.pull(this);
    const moveResult = this.move(hauler);
    if (pullResult === OK && moveResult === OK) {
      // if path is 0 steps, hauler is at target or exit of a room, so swap positions
      if (haulerPathToTarget.length === 0) {
        const result = hauler.moveToW(this);
        CreepUtils.consoleLogIfWatched(this, `swap with hauler`, result);
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
    const exitPos = hauler.pos.findClosestByRange(FIND_EXIT);
    if (!exitPos) {
      CreepUtils.consoleLogIfWatched(this, `ERROR: no exit for hauler`);
      return ERR_NO_PATH;
    }
    let exitDir = hauler.pos.getDirectionTo(exitPos);
    if (!exitDir) {
      if (hauler.pos.x === 0) exitDir = LEFT;
      if (hauler.pos.y === 0) exitDir = TOP;
      if (hauler.pos.x === 49) exitDir = RIGHT;
      if (hauler.pos.y === 49) exitDir = BOTTOM;
    }
    const awayFromExitDir = ((exitDir + 4) % 8) as DirectionConstant;
    console.log(`DEBUG: exitPos: ${String(exitPos)}, exit dir: ${exitDir}, reverse: ${awayFromExitDir}`);

    if (hauler.memory.exitState === undefined) {
      hauler.memory.exitState = ExitState.NOT_EXITING;
    }
    const exitState = hauler.memory.exitState;
    console.log(`DEBUG: exit state: ${String(exitState)}`);
    let result: ScreepsReturnCode;
    switch (exitState) {
      case ExitState.AT_EDGE:
        hauler.pull(this);
        this.move(hauler);
        result = hauler.move(exitDir);
        CreepUtils.consoleLogIfWatched(this, `at edge, moving to next room`, result);
        if (result === OK) {
          hauler.memory.exitState = ExitState.WAITING;
        }
        break;
      case ExitState.WAITING:
        result = hauler.move(hauler);
        CreepUtils.consoleLogIfWatched(this, `waiting a tick to return`, result);
        if (result === OK) {
          hauler.memory.exitState = ExitState.SWAPPING;
        }
        break;
      case ExitState.SWAPPING:
        hauler.pull(this);
        this.move(hauler);
        result = hauler.move(this);
        CreepUtils.consoleLogIfWatched(this, `swap with cargo`, result);
        if (result === OK) {
          hauler.memory.exitState = ExitState.EXITING;
        }
        break;
      case ExitState.EXITING:
        result = hauler.move(exitDir);
        CreepUtils.consoleLogIfWatched(this, `exit room after cargo`, result);
        if (result === OK) {
          hauler.memory.exitState = ExitState.LEAVE_EDGE;
        }
        break;
      case ExitState.LEAVE_EDGE:
        result = hauler.move(awayFromExitDir);
        CreepUtils.consoleLogIfWatched(this, `move away from edge`, result);
        if (result === OK) {
          hauler.memory.exitState = ExitState.PULL;
        }
        break;
      case ExitState.PULL:
        hauler.pull(this);
        this.move(hauler);
        result = hauler.move(awayFromExitDir);
        CreepUtils.consoleLogIfWatched(this, `pull cargo away from edge`, result);
        if (result === OK) {
          hauler.memory.exitState = ExitState.NOT_EXITING;
        }
        break;
      case ExitState.NOT_EXITING:
        result = ERR_INVALID_ARGS;
        break;

      default:
        assertNever(exitState);
    }

    function assertNever(x: never): never {
      throw new Error("Missing enum case: " + JSON.stringify(x));
    }

    return result;
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
