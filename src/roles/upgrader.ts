import { CreepRole } from "config/creep-types";
import { CreepUtils } from "creep-utils";
import { MemoryUtils } from "planning/memory-utils";
import { Minder } from "./minder";

export class Upgrader extends Minder {
  public static readonly ROLE = CreepRole.UPGRADER;
  public static readonly BODY_PROFILE: CreepBodyProfile = {
    profile: [WORK],
    seed: [CARRY],
    maxBodyParts: 10
  };

  protected getDestination(): RoomPosition | undefined {
    // return cached destination
    if (this.memory.destination) {
      return MemoryUtils.unpackRoomPosition(this.memory.destination);
    } else if (this.room.controller) {
      const destination = this.room.controller.pos;
      this.memory.destination = MemoryUtils.packRoomPosition(destination);
      CreepUtils.consoleLogIfWatched(this, `destination set as controller: ${String(destination)}`);
      return destination;
    }
    return undefined;
  }

  // TODO avoid harvest positions
  public atDestination(pos = this.pos): boolean {
    CreepUtils.consoleLogIfWatched(this, `atDestination current pos: ${String(pos)}`);
    if (this.room.controller) {
      const controller = this.room.controller;
      CreepUtils.consoleLogIfWatched(this, `destination: ${String(controller)}`);
      let inRange = pos.inRangeTo(controller, 3);
      CreepUtils.consoleLogIfWatched(this, `In range to controller? ${String(inRange)}`);
      if (this.roomw.memory.controller.containerId) {
        const container = Game.getObjectById(this.roomw.memory.controller.containerId);
        if (container) {
          // if dest isn't controller, must be container, so be in both transfer and upgrade range
          const inRangeToContainer = pos.inRangeTo(container, 1);
          CreepUtils.consoleLogIfWatched(this, `In range to container? ${String(inRangeToContainer)}`);
          inRange = inRangeToContainer && inRange;
        }
      }
      // don't upgrade from a harvest position
      const inRangeToSource = this.roomw.sources.find(source => source.pos.isNearTo(this.pos));
      return inRange && !inRangeToSource;
    }
    // if no destination, I guess we're here
    return true;
  }
}
