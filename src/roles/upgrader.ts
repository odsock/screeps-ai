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
    const containerId = this.claimControllerContainer();
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
    if (this.memory.destination && this.room.controller) {
      const destination = MemoryUtils.unpackRoomPosition(this.memory.destination);
      if (this.memory.destinationType === STRUCTURE_CONTROLLER) {
        return pos.inRangeTo(destination, 3);
      }
      // if dest isn't controller, must be container, so be in transfer and upgrade range
      return pos.inRangeTo(destination, 1) && pos.inRangeTo(this.room.controller, 3);
    }
    // if no destination, I guess we're here
    return true;
  }
}
