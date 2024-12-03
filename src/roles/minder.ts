import { CreepUtils } from "creep-utils";

import { CreepWrapper } from "./creep-wrapper";
import { Hauler } from "./hauler";

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

export abstract class Minder extends CreepWrapper {
  private myHauler: Hauler | undefined;

  protected retireCreep(retiree: Creep): ScreepsReturnCode {
    // request suicide if next to retiree
    if (retiree.pos.inRangeTo(this.pos, 2)) {
      const result = retiree.suicide();
      CreepUtils.consoleLogIfWatched(this, `requested retirement of ${retiree.name}`, result);
      this.memory.replacing = undefined;
      return result;
    }
    return OK;
  }

  /** use hauler creep to pull to destination */
  public abstract moveToDestination(): ScreepsReturnCode;

  protected harvestFromNearbySource(): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `harvesting from source`);
    let result: ScreepsReturnCode = ERR_NOT_IN_RANGE;
    const sources = this.pos.findInRange(FIND_SOURCES, 1);
    if (sources.length > 0) {
      result = this.harvest(sources[0]);
    }
    CreepUtils.consoleLogIfWatched(this, `harvest result`, result);
    return result;
  }

  protected buildNearbySite(): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `building nearby site`);
    let result: ScreepsReturnCode = ERR_NOT_FOUND;
    const site = this.pos.findClosestByRange(FIND_MY_CONSTRUCTION_SITES, { filter: { range: 3 } });
    if (site) {
      result = this.build(site);
    }
    CreepUtils.consoleLogIfWatched(this, `build result`, result);
    return result;
  }

  protected repairNearbySite(): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `repairing nearby site`);
    let result: ScreepsReturnCode = ERR_NOT_FOUND;
    const site = this.pos.findClosestByRange(FIND_MY_STRUCTURES, { filter: { range: 3 } });
    if (site) {
      result = this.repair(site);
    }
    CreepUtils.consoleLogIfWatched(this, `repair result`, result);
    return result;
  }

  protected upgrade(): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `upgrading`);
    let result: ScreepsReturnCode = ERR_NOT_FOUND;
    if (this.room.controller && this.pos.inRangeTo(this.room.controller.pos, 3)) {
      result = this.upgradeController(this.room.controller);
    }
    CreepUtils.consoleLogIfWatched(this, `upgrade result`, result);
    return result;
  }

  protected cancelHauler(): void {
    this.memory.haulRequested = false;
    this.memory.haulerName = undefined;
  }

  protected waitingForTug(): boolean {
    return !!this.memory.haulRequested;
  }

  protected callHauler(): void {
    CreepUtils.consoleLogIfWatched(this, `calling for tug`);
    this.memory.haulRequested = true;
  }

  protected getHauler(): Hauler | undefined {
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

  protected directHauler(
    target: RoomPosition,
    range = 0,
    costCallback = this.costMatrixUtils.creepMovementCostCallback
  ): ScreepsReturnCode {
    const hauler = this.getHauler();
    if (!hauler) {
      CreepUtils.consoleLogIfWatched(this, `calling hauler for path`);
      this.callHauler();
      return ERR_NOT_FOUND;
    }

    // get haulers path to target
    const haulerPathToTarget = hauler.pos.findPathTo(target, { range, costCallback });

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
    if (pullResult !== OK) {
      CreepUtils.consoleLogIfWatched(this, `hauler failed to pull`, pullResult);
      return pullResult;
    }
    const moveResult = this.move(hauler);
    if (moveResult !== OK) {
      CreepUtils.consoleLogIfWatched(this, `failed to move to hauler`, moveResult);
      return moveResult;
    }

    // if path is 0 steps, hauler is at target or exit of a room, so swap positions
    if (haulerPathToTarget.length === 0) {
      const result = hauler.moveToW(this);
      CreepUtils.consoleLogIfWatched(this, `swap with hauler`, result);
      return result;
    }

    // move hauler along the path
    const haulResult = hauler.moveByPath(haulerPathToTarget);
    CreepUtils.consoleLogIfWatched(this, `haul`, haulResult);

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

    if (hauler.memory.exitState === undefined) {
      hauler.memory.exitState = ExitState.NOT_EXITING;
    }
    const exitState = hauler.memory.exitState;
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

  /** get container object for id in memory, clear memory if not valid */
  protected resolveContainerIdFromMemory(): StructureContainer | undefined {
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
}
