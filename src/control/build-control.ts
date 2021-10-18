import { CreepRole } from "config/creep-types";
import { SockPuppetConstants } from "config/sockpuppet-constants";
import { CreepUtils } from "creep-utils";
import { Builder } from "roles/builder";
import { Fixer } from "roles/fixer";
import { RoomWrapper } from "structures/room-wrapper";
import { SpawnUtils } from "./spawn-utils";

export class BuildControl {
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

    // FIXER
    const fixerCount = SpawnUtils.getCreepCountForRole(roomw, CreepRole.FIXER);
    if (roomw.repairSites.length > 0 && fixerCount < SockPuppetConstants.MAX_FIXER_CREEPS) {
      spawnQueue.push({
        bodyProfile: Fixer.BODY_PROFILE,
        max: true,
        role: Fixer.ROLE,
        priority: 30
      });
    }

    // BUILDER
    // make builders if there's something to build
    const builderCount = SpawnUtils.getCreepCountForRole(roomw, CreepRole.BUILDER);
    const workPartsNeeded = this.getBuilderWorkPartsNeeded(roomw);
    const conSiteCount = roomw.constructionSites.length;
    CreepUtils.consoleLogIfWatched(
      roomw,
      `builders: ${builderCount}, ${conSiteCount} sites, ${workPartsNeeded} parts needed`
    );
    if (conSiteCount > 0 && workPartsNeeded > 0) {
      spawnQueue.push({
        bodyProfile: SpawnUtils.buildBodyProfile(Builder.BODY_PROFILE, workPartsNeeded),
        role: Builder.ROLE,
        priority: 30
      });
    }

    roomw.memory.spawnQueue = spawnQueue;
  }

  private getBuilderWorkPartsNeeded(roomw: RoomWrapper): number {
    const conWork = roomw.constructionWork;
    const activeWorkParts = roomw.getActiveParts(Builder.ROLE, WORK);
    const workPartsNeeded = Math.ceil(conWork / SockPuppetConstants.WORK_PER_WORKER_PART);
    const workPartsDeficit = workPartsNeeded - activeWorkParts;
    return workPartsDeficit > 0 ? workPartsDeficit : 0;
  }
}
