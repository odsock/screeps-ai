import { CreepRole } from "config/creep-types";
import { CreepUtils } from "creep-utils";
import { MemoryUtils } from "planning/memory-utils";
import { Minder } from "./minder";

export class Harvester extends Minder {
  public static ROLE: CreepRole = CreepRole.HARVESTER;
  public static BODY_PROFILE: CreepBodyProfile = {
    profile: [WORK],
    seed: [],
    maxBodyParts: 5
  };

  protected getDestination(): RoomPosition | undefined {
    // return cached destination if set
    if (this.memory.destination) {
      return MemoryUtils.unpackRoomPosition(this.memory.destination);
    }

    // choose new destination
    let destination: RoomPosition | undefined;
    // try to choose container destination
    const containerId = this.claimContainer(info => info.nearSource && !info.minderId);
    if (containerId) {
      const container = Game.getObjectById(containerId);
      if (container) {
        destination = container.pos;
        this.memory.destination = MemoryUtils.packRoomPosition(destination);
        this.memory.destinationType = STRUCTURE_CONTAINER;
        CreepUtils.consoleLogIfWatched(this, `destination controller container: ${String(destination)}`);
      }
    }
    // use the source as destination
    if (!destination) {
      CreepUtils.consoleLogIfWatched(this, `finding source destination`);
      const harvesters = this.room.find(FIND_MY_CREEPS, { filter: creep => creep.memory.role === Harvester.ROLE });
      const harvestersBySource = _.groupBy(harvesters, creep => creep.memory.source);
      const sourceWithRoom = this.roomw.sources.find(
        source => harvestersBySource[source.id]?.length < this.roomw.getHarvestPositions(source.id).length
      );
      if (sourceWithRoom) {
        destination = sourceWithRoom.pos;
        this.memory.destination = MemoryUtils.packRoomPosition(destination);
        this.memory.destinationType = LOOK_SOURCES;
        CreepUtils.consoleLogIfWatched(this, `destination source: ${String(destination)}`);
      }
    }
    return destination;
  }

  protected atDestination(): boolean {
    if (this.memory.destination) {
      const destination = MemoryUtils.unpackRoomPosition(this.memory.destination);
      if (this.memory.destinationType === LOOK_SOURCES) {
        return this.pos.inRangeTo(destination, 1);
      }
      // if dest isn't source, must be container, so sit on it
      return this.pos.isEqualTo(destination);
    }
    // if no destination, I guess we're here
    return true;
  }
}
