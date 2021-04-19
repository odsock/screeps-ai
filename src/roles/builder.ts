import { CreepWrapper } from "./creep-wrapper";
import { CreepUtils } from "creep-utils";
import config from "../constants";

export class Builder extends CreepWrapper {
  public run(): void {
    this.touchRoad();

    // build if anything to build
    if (this.roomw.constructionSites.length > 0) {
      CreepUtils.consoleLogIfWatched(this, "building job");
      this.doBuildJob();
      return;
    }

    CreepUtils.consoleLogIfWatched(this, "no work left. this is the end.");
    this.suicide();
  }

  private doBuildJob(): void {
    let site: ConstructionSite | null = null;
    const centerPos = new RoomPosition(config.ROOM_SIZE / 2, config.ROOM_SIZE / 2, this.room.name);
    for (let i = 0; !site && i < config.CONSTRUCTION_PRIORITY.length; i++) {
      site = centerPos.findClosestByPath(FIND_MY_CONSTRUCTION_SITES, {
        filter: s => s.structureType === config.CONSTRUCTION_PRIORITY[i]
      });
    }
    if (!site) {
      site = centerPos.findClosestByPath(FIND_MY_CONSTRUCTION_SITES);
    }
    CreepUtils.consoleLogIfWatched(this, `found site: ${String(site)}`);

    if (site) {
      this.updateJob("building");
      this.stopWorkingIfEmpty();
      this.startWorkingIfFull("🚧 build");
      this.workIfCloseToJobsite(site.pos);

      CreepUtils.consoleLogIfWatched(this, `working: ${String(this.memory.working)}`);
      if (this.memory.working) {
        // don't block the source while working
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
}
