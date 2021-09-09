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
      let path;
      // move to controller container if it exists
      if (this.room.memory.controller.containerId) {
        const container = Game.getObjectById(this.room.memory.controller.containerId);
        if (container) {
          path = this.pos.findPathTo(container, {
            range: 1,
            costCallback: (roomName, costMatrix) => {
              this.roomw.getCostMatrix("avoidHarvestPositions", costMatrix);
            }
          });
        }
      }

      // move to controller link if it exists
      if (this.room.memory.controller.linkId) {
        const link = Game.getObjectById(this.room.memory.controller.linkId);
        if (link) {
          path = this.pos.findPathTo(link, {
            range: 1,
            costCallback: (roomName, costMatrix) => {
              this.roomw.getCostMatrix("avoidHarvestPositions", costMatrix);
            }
          });
        }
      }

      // move to controller
      path = this.pos.findPathTo(this.room.controller, {
        range: 3,
        costCallback: (roomName, costMatrix) => {
          this.roomw.getCostMatrix("avoidHarvestPositions", costMatrix);
        }
      });

      if (path.length > 0) {
        this.callTug();
        if (this.memory.haulerName) {
          const hauler = Game.creeps[this.memory.haulerName];
          if (hauler) {
            const pullResult = hauler.pull(this);
            const moveResult = this.moveTo(hauler);
            if (pullResult === OK && moveResult === OK) {
              if (path.length === 1) {
                return hauler.moveTo(this);
              }
              return hauler.moveByPath(path);
            } else {
              CreepUtils.consoleLogIfWatched(this, `failed to pull. pull ${pullResult}, move ${moveResult}`);
              return ERR_INVALID_ARGS;
            }
          } else {
            this.cancelTug();
          }
        }
      }
    }
    return OK;
  }
}
