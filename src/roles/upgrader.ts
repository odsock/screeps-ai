import { CreepRole } from "config/creep-types";
import { CreepUtils } from "creep-utils";
import { CreepBodyProfile } from "./creep-wrapper";
import { Minder } from "./minder";
import { profile } from "../../screeps-typescript-profiler";

@profile
export class Upgrader extends Minder {
  public static readonly ROLE = CreepRole.UPGRADER;
  public static readonly BODY_PROFILE: CreepBodyProfile = {
    profile: [WORK],
    seed: [CARRY, WORK],
    maxBodyParts: 21
  };

  public run(): void {
    this.moveToDestination();

    // retire old creep if valid retiree set
    if (this.memory.retiree) {
      const retiree = Game.creeps[this.memory.retiree];
      if (retiree) {
        this.retireCreep(retiree);
        return;
      } else {
        this.memory.retiree = undefined;
      }
    }

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

  public moveToDestination(): ScreepsReturnCode {
    if (this.room.controller) {
      let target: RoomPosition | undefined;
      let findPathOpts: FindPathOpts | undefined;
      // move to controller container if it exists
      if (this.room.memory.controller.containerId) {
        const container = Game.getObjectById(this.room.memory.controller.containerId);
        if (container) {
          CreepUtils.consoleLogIfWatched(this, `finding path to controller container`);
          target = container.pos;
          findPathOpts = {
            range: 1,
            costCallback: (roomName, costMatrix) =>
              this.roomw.getCostMatrixAvoidHarvestPositionsAndRoadsNearController(costMatrix)
          };
        }
      }

      // move to controller
      if (!target) {
        CreepUtils.consoleLogIfWatched(this, `finding path to controller`);
        target = this.room.controller.pos;
        findPathOpts = {
          range: 3,
          costCallback: (roomName, costMatrix) =>
            this.roomw.getCostMatrixAvoidHarvestPositionsAndRoadsNearController(costMatrix)
        };
      }

      if (target) {
        // cancel hauler call if at target
        const myPathToTarget = this.pos.findPathTo(target, findPathOpts);
        if (myPathToTarget.length === 0) {
          CreepUtils.consoleLogIfWatched(this, `at target, don't need hauler`);
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
          }
        }
      }
    }
    return OK;
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
