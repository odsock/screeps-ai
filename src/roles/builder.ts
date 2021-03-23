import { CreepUtils } from "creep-utils";
import config from "../constants";
import { CreepWrapper } from "./creep-wrapper";

export class Builder extends CreepWrapper {
  public run(): void {
    super.run();

    // build if anything to build
    if (this.roomw.constructionSites.length > 0) {
      CreepUtils.consoleLogIfWatched(this, 'building job');
      this.doBuildJob();
      return;
    }

    CreepUtils.consoleLogIfWatched(this, 'no work left. this is the end.');
    this.suicide();
  }

  private doBuildJob(): void {
    let site: ConstructionSite | null = null;
    for (let i = 0; !site && i < config.CONSTRUCTION_PRIORITY.length; i++) {
      site = this.pos.findClosestByPath(FIND_MY_CONSTRUCTION_SITES, {
        filter: (s) => s.structureType == config.CONSTRUCTION_PRIORITY[i]
      });
    }
    if (!site) {
      site = this.pos.findClosestByPath(FIND_MY_CONSTRUCTION_SITES);
    }

    if (site) {
      this.updateJob('building');
      this.stopWorkingIfEmpty();
      this.startWorkingIfFull('🚧 build');
      this.workIfCloseToJobsite(site.pos);

      if (this.memory.working) {
        // don't block the source while working
        const closestEnergySource = this.findClosestActiveEnergySource();
        if (closestEnergySource?.pos && this.pos.isNearTo(closestEnergySource)) {
          const path = PathFinder.search(this.pos, { pos: closestEnergySource.pos, range: 2 }, { flee: true });
          this.moveByPath(path.path);
        }
        else if (this.build(site as ConstructionSite) == ERR_NOT_IN_RANGE) {
          this.moveTo(site as ConstructionSite, { visualizePathStyle: { stroke: '#ffffff' } });
        }
      }
      else {
        this.harvestByPriority();
      }
    }
  }
}
