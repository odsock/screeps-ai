import { CreepRole } from "config/creep-types";
import { SockPuppetConstants } from "config/sockpuppet-constants";
import { CreepUtils } from "creep-utils";
import { SpawnQueue } from "planning/spawn-queue";
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
    const spawnQueue = SpawnQueue.getInstance(roomw);

    // FIXER
    const fixerCount = SpawnUtils.getCreepCountForRole(roomw, CreepRole.FIXER);
    if (roomw.repairSites.length > 0 && fixerCount < SockPuppetConstants.MAX_FIXER_CREEPS) {
      spawnQueue.push({
        bodyProfile: Fixer.BODY_PROFILE,
        max: true,
        memory: { role: Fixer.ROLE },
        priority: 30
      });
    }

    // BUILDER
    // make builders if there's something to build, or walls/ramparts to upgrade
    const conSiteCount = roomw.constructionSites.length;
    const wallsBelowMax = roomw.find(FIND_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_WALL && s.hits < SockPuppetConstants.MAX_HITS_WALL
    }).length;
    const rampartsBelowMax = roomw.find(FIND_MY_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_RAMPART && s.hits < SockPuppetConstants.MAX_HITS_WALL
    }).length;
    if (conSiteCount > 0 || wallsBelowMax > 0 || rampartsBelowMax > 0) {
      const builderCount = SpawnUtils.getCreepCountForRole(roomw, CreepRole.BUILDER);
      const workPartsNeeded = this.getBuilderWorkPartsNeeded(roomw);
      CreepUtils.consoleLogIfWatched(
        roomw,
        `builders: ${builderCount}, ${conSiteCount} sites, ${wallsBelowMax} walls to build, ${workPartsNeeded} parts needed`
      );
      if (workPartsNeeded > 0 && builderCount < SockPuppetConstants.MAX_BUILDER_CREEPS) {
        spawnQueue.push({
          bodyProfile: Builder.BODY_PROFILE,
          max: true,
          memory: { role: Builder.ROLE },
          priority: 30
        });
      }
    }
  }

  private getBuilderWorkPartsNeeded(roomw: RoomWrapper): number {
    const wallWork = roomw
      .find(FIND_STRUCTURES, {
        filter: s =>
          (s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART) &&
          s.hits < SockPuppetConstants.MAX_HITS_WALL
      })
      .reduce((hits, wall) => (hits += SockPuppetConstants.MAX_HITS_WALL - wall.hits), 0);
    const conWork = roomw.constructionWork;
    const activeWorkParts = roomw.getActiveParts(Builder.ROLE, WORK);
    const workPartsNeeded = Math.ceil((conWork + wallWork) / SockPuppetConstants.WORK_PER_WORKER_PART);
    const workPartsDeficit = workPartsNeeded - activeWorkParts;
    return workPartsDeficit > 0 ? workPartsDeficit : 0;
  }
}
