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
    }

    // choose new destination
    let destination: RoomPosition | undefined;
    // try to choose container destination
    const containerId = this.roomw.memory.controller.containerId;
    if (containerId) {
      const container = Game.getObjectById(containerId);
      if (container) {
        destination = container.pos;
        this.memory.destination = MemoryUtils.packRoomPosition(destination);
        this.memory.destinationType = STRUCTURE_CONTAINER;
        CreepUtils.consoleLogIfWatched(this, `destination controller container: ${String(destination)}`);
      }
    }
    // use the controller as destination
    if (!destination && this.room.controller) {
      destination = this.room.controller.pos;
      this.memory.destination = MemoryUtils.packRoomPosition(destination);
      this.memory.destinationType = STRUCTURE_CONTROLLER;
      CreepUtils.consoleLogIfWatched(this, `destination controller: ${String(destination)}`);
    }
    return destination;
  }

  // TODO avoid harvest positions
  public atDestination(pos = this.pos): boolean {
    CreepUtils.consoleLogIfWatched(this, `atDestination current pos: ${String(pos)}`);
    if (this.memory.destination && this.room.controller) {
      const destination = MemoryUtils.unpackRoomPosition(this.memory.destination);
      CreepUtils.consoleLogIfWatched(this, `destination: ${String(destination)}`);
      if (this.memory.destinationType === STRUCTURE_CONTROLLER) {
        const inRangeToDestination = pos.inRangeTo(destination, 3);
        CreepUtils.consoleLogIfWatched(this, `destination is controller. In range? ${String(inRangeToDestination)}`);
        return inRangeToDestination;
      }
      const inRangeToController = pos.inRangeTo(this.room.controller, 3);
      const inRangeToContainer = pos.inRangeTo(destination, 1);
      // if dest isn't controller, must be container, so be in transfer and upgrade range
      const inRange = inRangeToContainer && inRangeToController;
      CreepUtils.consoleLogIfWatched(
        this,
        `destination is container. In range? container: ${String(inRangeToContainer)}, controller: ${String(
          inRangeToContainer
        )}`
      );
      return inRange;
    }
    // if no destination, I guess we're here
    return true;
  }
}
