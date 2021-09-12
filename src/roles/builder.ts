import { CreepWrapper } from "./creep-wrapper";
import { CreepUtils } from "creep-utils";
import { CreepRole } from "config/creep-types";
import { SockPuppetConstants } from "config/sockpuppet-constants";

export class Builder extends CreepWrapper {
  public static readonly ROLE = CreepRole.BUILDER;
  public static readonly BODY_PROFILE: CreepBodyProfile = {
    profile: [WORK, MOVE, CARRY],
    seed: [],
    maxBodyParts: MAX_CREEP_SIZE
  };

  public run(): void {
    // build if anything to build
    if (this.roomw.constructionSites.length > 0) {
      CreepUtils.consoleLogIfWatched(this, "building job");
      this.doBuildJob();
      return;
    }

    CreepUtils.consoleLogIfWatched(this, "no work left. this is the end.");
    // TODO walk to storage or spawn and transfer before suicide
    this.suicide();
  }

  private doBuildJob(): void {
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
        if (closestEnergySource?.pos && this.pos.isNearTo(closestEnergySource) && this.pos.inRangeTo(site.pos, 3)) {
          CreepUtils.consoleLogIfWatched(this, `moving away from source`);
          const path = PathFinder.search(this.pos, { pos: closestEnergySource.pos, range: 2 }, { flee: true });
          this.moveByPath(path.path);
        } else if (this.build(site) === ERR_NOT_IN_RANGE) {
          CreepUtils.consoleLogIfWatched(this, `moving to site`);
          this.moveTo(site, { visualizePathStyle: { stroke: "#ffffff" } });
        }
      } else {
        CreepUtils.consoleLogIfWatched(this, `going to harvest`);
        this.harvestByPriority();
      }
    }
  }

  private findBuildCenterPos() {
    let centerStructure: Structure | undefined = this.roomw.spawns[0];
    if (!centerStructure) {
      centerStructure = this.roomw.controller;
    }
    let centerPos: RoomPosition;
    if (centerStructure) {
      centerPos = centerStructure.pos;
    } else {
      centerPos = new RoomPosition(
        SockPuppetConstants.ROOM_SIZE / 2,
        SockPuppetConstants.ROOM_SIZE / 2,
        this.room.name
      );
    }
    return centerPos;
  }

  private getConstructionSite(): ConstructionSite<BuildableStructureConstant> | undefined {
    const siteId = this.memory.constructionSiteId;
    let site = Game.getObjectById(siteId as Id<ConstructionSite>);
    if (site) {
      return site;
    }

    if (!site) {
      const centerPos = this.findBuildCenterPos();
      const sites = this.roomw.find(FIND_MY_CONSTRUCTION_SITES);
      const groupedSites = _.groupBy(sites, aSite => aSite.structureType);
      const siteType = SockPuppetConstants.CONSTRUCTION_PRIORITY.find(
        type => groupedSites[type] && groupedSites[type].length > 0
      );
      if (siteType) {
        const closestSite = this.pos.findClosestByPath(groupedSites[siteType]);
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
      CreepUtils.consoleLogIfWatched(this, `center pos: ${String(centerPos)}, found site: ${String(site)}`);
    }
    return undefined;
  }
}
