import { CreepRole } from "config/creep-types";
import { SockPuppetConstants } from "config/sockpuppet-constants";
import { CreepUtils } from "creep-utils";
import { SpawnQueue } from "planning/spawn-queue";
import { Upgrader } from "roles/upgrader";
import { RoomWrapper } from "structures/room-wrapper";

import { SpawnUtils } from "./spawn-utils";
import { CreepBodyUtils } from "roles/creep-body-utils";

export class UpgradeControl {
  public run(): void {
    for (const roomName in Game.rooms) {
      const roomw = RoomWrapper.getInstance(roomName);

      if (roomw.controller?.my && roomw.spawns.length > 0) {
        this.requestSpawns(roomw, roomw.controller.level);
      }
    }
  }

  private requestSpawns(roomw: RoomWrapper, rcl: number): void {
    if (roomw.find(FIND_MY_CONSTRUCTION_SITES).length > 0) {
      CreepUtils.consoleLogIfWatched(roomw, `skipping upgraders during construction`);
      return;
    }

    const upgraders = roomw.getUpgraders();
    const upgradersSpawningCount = SpawnUtils.getSpawningCountForRole(roomw, CreepRole.UPGRADER);
    const upgraderCount = upgraders.length + upgradersSpawningCount;
    let upgradePositionCount = 1;
    let upgraderWorkPartsActive = 0;
    const upgraderWorkPartsNeeded =
      roomw.controller?.level === 8
        ? CONTROLLER_MAX_UPGRADE_PER_TICK / UPGRADE_CONTROLLER_POWER
        : (roomw.sourcesEnergyCapacity / ENERGY_REGEN_TIME / UPGRADE_CONTROLLER_POWER) *
          SockPuppetConstants.UPGRADE_EFFICIENCY_RATIO;

    // don't spawn more than one upgrader at level 1
    // don't calc required upgraders if we have none
    if (upgraderCount > 0 && rcl > 1) {
      upgradePositionCount = Math.min(SockPuppetConstants.MAX_UPGRADERS, roomw.getUpgradePositions().length);
      upgraderWorkPartsActive = roomw.getActiveParts(Upgrader.ROLE, WORK);
      CreepUtils.consoleLogIfWatched(
        roomw,
        `upgraders: ${upgraderCount}/${upgradePositionCount} positions, ${upgraderWorkPartsActive}/${upgraderWorkPartsNeeded} parts`
      );
    }

    const spawnQueue = SpawnQueue.getInstance(roomw);
    if (
      upgraderCount === 0 ||
      (upgraderWorkPartsActive < upgraderWorkPartsNeeded && upgraderCount < upgradePositionCount)
    ) {
      spawnQueue.push({
        bodyProfile: CreepBodyUtils.buildBodyProfile(
          Upgrader.BODY_PROFILE,
          upgraderWorkPartsNeeded - upgraderWorkPartsActive,
          WORK
        ),
        max: true,
        memory: { role: Upgrader.ROLE, containerId: roomw.memory.controller.container?.id },
        priority: 80
      });
    }

    // replace upgrader older than ticks-to-spawn-replacement if at or below needed level
    if (upgraderCount <= upgradePositionCount && upgraderWorkPartsActive <= upgraderWorkPartsNeeded) {
      const oldestCreep = CreepUtils.findOldestCreep(upgraders.filter(creep => !creep.memory.retiring));
      const ticksToSpawn = SpawnUtils.calcSpawnTime(Upgrader.BODY_PROFILE, roomw);
      if (oldestCreep?.ticksToLive && oldestCreep.ticksToLive <= ticksToSpawn + 50) {
        CreepUtils.consoleLogIfWatched(roomw, `spawning replacement ${Upgrader.ROLE}`);
        spawnQueue.push({
          bodyProfile: Upgrader.BODY_PROFILE,
          max: true,
          memory: {
            role: Upgrader.ROLE,
            replacing: oldestCreep.name
          },
          priority: 90
        });
      }
    }
  }
}
