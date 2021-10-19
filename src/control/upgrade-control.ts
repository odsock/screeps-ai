import { CreepRole } from "config/creep-types";
import { CreepUtils } from "creep-utils";
import { CreepWrapperProfile } from "roles/creep-wrapper";
import { Upgrader } from "roles/upgrader";
import { RoomWrapper } from "structures/room-wrapper";
import { profile } from "../../screeps-typescript-profiler";
import { SpawnRequest } from "./spawn-control";
import { SpawnUtils } from "./spawn-utils";

@profile
export class UpgradeControl {
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

    const upgraderCount = SpawnUtils.getCreepCountForRole(roomw, CreepRole.UPGRADER);

    // FIRST UPGRADER
    // start upgrading once harvesting efficiently
    if (upgraderCount === 0) {
      spawnQueue.push({
        bodyProfile: Upgrader.BODY_PROFILE,
        max: true,
        role: Upgrader.ROLE,
        priority: 80
      });
    }

    // UPGRADER
    // spawn enough upgraders to match source capacity
    // don't spawn upgraders during construction
    if (roomw.find(FIND_MY_CONSTRUCTION_SITES).length > 0 && upgraderCount > 0) {
      CreepUtils.consoleLogIfWatched(roomw, `skipping upgraders during construction`);
    } else {
      const upgradePositionCount = roomw.getUpgradePositions().length;
      const upgraderWorkPartsNeeded = roomw.sourcesEnergyCapacity / ENERGY_REGEN_TIME / UPGRADE_CONTROLLER_POWER;
      const upgraderWorkPartsActive = roomw.getActiveParts(Upgrader.ROLE, WORK);
      CreepUtils.consoleLogIfWatched(
        roomw,
        `upgraders: ${upgraderCount}/${upgradePositionCount} positions, ${upgraderWorkPartsActive}/${upgraderWorkPartsNeeded} parts`
      );
      if (upgraderWorkPartsActive < upgraderWorkPartsNeeded && upgraderCount < upgradePositionCount) {
        const bodyProfile = SpawnUtils.buildBodyProfile(Upgrader.BODY_PROFILE, upgraderWorkPartsNeeded);
        spawnQueue.push({
          bodyProfile,
          role: Upgrader.ROLE,
          priority: 80
        });
      } else if (upgraderCount <= upgradePositionCount) {
        SpawnUtils.requestReplacementCreep(roomw, Upgrader, spawnQueue);
      }
    }

    roomw.memory.spawnQueue = spawnQueue;
  }
}
