import { CreepUtils } from "creep-utils";
import { SpawnQueue } from "planning/spawn-queue";
import { Harvester } from "roles/harvester";
import { RoomWrapper } from "structures/room-wrapper";
import { profile } from "../../screeps-typescript-profiler";
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
    const spawnQueue = SpawnQueue.getInstance(roomw);

    const harvesterCount = SpawnUtils.getCreepCountForRole(roomw, Harvester.ROLE);

    // FIRST HARVESTER
    // always need at least one harvester
    if (harvesterCount === 0) {
      spawnQueue.push({
        bodyProfile: Harvester.BODY_PROFILE,
        memory: { role: Harvester.ROLE },
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
        memory: { role: Harvester.ROLE },
        priority: 90
      });
    }
    // replace aging harvester
    if (harvesterWorkParts <= harvesterWorkPartsNeeded && harvesterCount <= harvestPositionCount) {
      SpawnUtils.requestReplacementCreep(roomw, Harvester);
    }
  }
}
