import { CreepUtils } from "creep-utils";
import { CreepWrapperProfile } from "roles/creep-wrapper";
import { Harvester } from "roles/harvester";
import { RoomWrapper } from "structures/room-wrapper";
import { profile } from "../../screeps-typescript-profiler";
import { SpawnRequest } from "./spawn-control";
import { SpawnUtils } from "./spawn-utils";

@profile
export class HarvestControl {
  public run(): void {
    for (const roomName in Game.rooms) {
      const roomw = RoomWrapper.getInstance(roomName);

      if (roomw.controller?.my && roomw.spawns.length > 0) {
        this.requestSpawns(roomw);
      }
    }
  }

  private requestSpawns(roomw: RoomWrapper) {
    const spawnQueue = roomw.memory.spawnQueue ?? [];

    const harvesterCount = SpawnUtils.getCreepCountForRole(roomw, Harvester.ROLE);

    // FIRST HARVESTER
    // always need at least one harvester
    if (harvesterCount === 0) {
      spawnQueue.push({
        bodyProfile: Harvester.BODY_PROFILE,
        role: Harvester.ROLE,
        priority: 90
      });
    }

    // HARVESTER
    // spawn enough harvesters to drain sources if they fit in harvest positions
    const harvesterWorkParts = roomw.getActiveParts(Harvester.ROLE, WORK);
    const harvesterWorkPartsNeeded = roomw.sourcesEnergyCapacity / ENERGY_REGEN_TIME / HARVEST_POWER;
    const harvestPositionCount = roomw.harvestPositionCount;
    CreepUtils.consoleLogIfWatched(
      roomw,
      `harvesters: ${harvesterCount}/${harvestPositionCount} positions, ${harvesterWorkParts}/${harvesterWorkPartsNeeded} parts`
    );
    if (harvesterWorkParts < harvesterWorkPartsNeeded && harvesterCount < harvestPositionCount) {
      spawnQueue.push({
        bodyProfile: Harvester.BODY_PROFILE,
        max: true,
        role: Harvester.ROLE,
        priority: 90
      });
    }
    // replace aging harvester
    // TODO needs check on current spawning to avoid doubles
    // if (harvesterWorkParts <= harvesterWorkPartsNeeded && harvesterCount <= harvestPositionCount) {
    //   this.requestReplacementMinder(roomw, Harvester, spawnQueue);
    // }

    roomw.memory.spawnQueue = spawnQueue;
  }

  private requestReplacementMinder(roomw: RoomWrapper, type: CreepWrapperProfile, spawnQueue: SpawnRequest[]): void {
    const creeps = roomw.find(FIND_MY_CREEPS, { filter: creep => creep.memory.role === type.ROLE });
    const ticksToReplace = SpawnUtils.calcReplacementTime(type.BODY_PROFILE, roomw);
    const oldestMinderIndex = creeps
      .filter(c => !c.memory.retiring && c.ticksToLive && c.ticksToLive <= ticksToReplace)
      .reduce((oldestIndex, c, index, array) => {
        const oldest = array[oldestIndex];
        if (!oldest || (c.ticksToLive && oldest.ticksToLive && c.ticksToLive < oldest.ticksToLive)) {
          return index;
        }
        return oldestIndex;
      }, -1);
    const oldestMinder = creeps[oldestMinderIndex];
    if (oldestMinder) {
      spawnQueue.push({
        bodyProfile: type.BODY_PROFILE,
        max: true,
        role: type.ROLE,
        replacing: oldestMinder.name,
        priority: 80
      });
      return;
    }
    return;
  }
}
