import { CreepWrapper } from "./creep-wrapper";
import { CreepBodyProfile } from "./creep-body-utils";
import { CreepUtils } from "creep-utils";
import { CreepRole } from "config/creep-types";
import { SockPuppetConstants } from "config/sockpuppet-constants";

import { profile } from "../../screeps-typescript-profiler";

@profile
export class Builder extends CreepWrapper {
  public static readonly ROLE = CreepRole.BUILDER;
  public static readonly BODY_PROFILE: CreepBodyProfile = {
    profile: [WORK, CARRY, CARRY, MOVE, MOVE],
    seed: [],
    maxBodyParts: 50
  };

  public run(): void {
    // build if anything to build
    if (this.roomw.constructionSites.length > 0) {
      CreepUtils.consoleLogIfWatched(this, "building job");
      this.doBuildJob();
      return;
    }

    // repair walls and ramparts to max
    if ((this.room.controller?.level ?? 0) >= SockPuppetConstants.WALL_MAINT_RCL) {
      let repairTarget: Structure | undefined;
      if (this.memory.lastTargetId) {
        repairTarget = Game.getObjectById(this.memory.lastTargetId) ?? undefined;
      }
      if (!repairTarget || repairTarget.hits >= SockPuppetConstants.MAX_HITS_WALL) {
        repairTarget = this.roomw.findWeakestWall();
        this.memory.lastTargetId = repairTarget?.id;
      }
      if (repairTarget) {
        this.doRepairJob(repairTarget);
        return;
      }
    }

    const dismantleTarget = this.findDismantleTarget();
    if (dismantleTarget) {
      this.doDismantleJob(dismantleTarget);
      return;
    }

    CreepUtils.consoleLogIfWatched(this, "no work left. this is the end.");
    const target = this.roomw.storage ?? this.roomw.spawns[0];
    const result = this.moveTo(target.pos, { range: 1 });
    CreepUtils.consoleLogIfWatched(this, `move to end pos result`, result);
    if (this.pos.isNearTo(target)) {
      const suicideResult = this.suicide();
      CreepUtils.consoleLogIfWatched(this, `suicide result`, suicideResult);
      return;
    }
  }

  private doBuildJob(): void {
    // BUG builders are not focused on single site
    const site = this.getConstructionSite();
    if (site) {
      this.memory.constructionSiteId = site.id;
      this.updateJob("building");
      this.stopWorkingIfEmpty();
      this.startWorkingIfFull();
      this.startWorkingInRange(site.pos);

      CreepUtils.consoleLogIfWatched(this, `working: ${String(this.memory.working)}`);
      if (this.memory.working) {
        // don't block a source while working
        const closestEnergySource = this.findClosestActiveEnergySource();
        if (
          closestEnergySource?.pos &&
          this.pos.isNearTo(closestEnergySource) &&
          this.pos.inRangeTo(site.pos, 3)
        ) {
          // TODO this can lead to looping when source is between builder and target, and target is in range. Builder flees away from target, then steps, back, repeats.
          CreepUtils.consoleLogIfWatched(this, `moving away from source`);
          const path = PathFinder.search(
            this.pos,
            { pos: closestEnergySource.pos, range: 2 },
            { flee: true }
          );
          this.moveByPath(path.path);
          return;
        }
        const result = this.build(site);
        if (result === ERR_NOT_IN_RANGE) {
          CreepUtils.consoleLogIfWatched(this, `moving to site`);
          this.moveTo(site, { visualizePathStyle: { stroke: "#ffffff" } });
        }
      } else if (this.roomw.hasSpawnEnergyBuffer()) {
        CreepUtils.consoleLogIfWatched(this, `going to harvest`);
        this.harvestByPriority();
      } else {
        CreepUtils.consoleLogIfWatched(this, `waiting for energy storage spawn buffer`);
      }
    }
  }

  private doRepairJob(target: Structure): ScreepsReturnCode {
    this.updateJob("repairing");
    this.stopWorkingIfEmpty();
    this.startWorkingIfFull();
    this.startWorkingInRange(target.pos);

    if (this.memory.working) {
      const result = this.moveToAndRepair(target);
      CreepUtils.consoleLogIfWatched(this, `repair result`, result);
      return result;
    } else {
      // clear cached repair target when not working
      delete this.memory.lastTargetId;
      this.harvestByPriority();
      return OK;
    }
  }

  private getConstructionSite(): ConstructionSite<BuildableStructureConstant> | undefined {
    const siteId = this.memory.constructionSiteId;
    let site = Game.getObjectById(siteId as Id<ConstructionSite>);
    if (site) {
      return site;
    } else {
      const centerPos = this.room.getColonyCenterPos();
      const sites = this.roomw.find(FIND_MY_CONSTRUCTION_SITES);
      const groupedSites = _.groupBy(sites, aSite => aSite.structureType);
      const siteType = SockPuppetConstants.CONSTRUCTION_PRIORITY.find(
        type => groupedSites[type] && groupedSites[type].length > 0
      );
      if (siteType) {
        const closestSite = centerPos.findClosestByPath(groupedSites[siteType]);
        if (closestSite) {
          site = closestSite;
        }
      }
      if (!site) {
        const closestSite = centerPos.findClosestByPath(FIND_MY_CONSTRUCTION_SITES);
        if (closestSite) {
          site = closestSite;
        }
      }
      if (site) {
        CreepUtils.consoleLogIfWatched(
          this,
          `center pos: ${String(centerPos)}, found site: ${String(site)}`
        );
        return site;
      }
    }
    return undefined;
  }
}
