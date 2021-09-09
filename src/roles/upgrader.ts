import { CreepRole } from "config/creep-types";
import { CreepUtils } from "creep-utils";
import { Minder } from "./minder";

export class Upgrader extends Minder {
  public static readonly ROLE = CreepRole.UPGRADER;
  public static readonly BODY_PROFILE: CreepBodyProfile = {
    profile: [WORK],
    seed: [CARRY],
    maxBodyParts: 10
  };

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
            costCallback: (roomName, costMatrix) => {
              this.roomw.getCostMatrix("avoidHarvestPositions", costMatrix);
            }
          };
        }
      }

      // move to controller
      if (!target) {
        CreepUtils.consoleLogIfWatched(this, `finding path to controller`);
        target = this.room.controller.pos;
        findPathOpts = {
          range: 3,
          costCallback: (roomName, costMatrix) => {
            this.roomw.getCostMatrix("avoidHarvestPositions", costMatrix);
          }
        };
      }

      if (target) {
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
          }
        }
      }
    }
    return OK;
  }
}
