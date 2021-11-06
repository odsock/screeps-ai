import { CreepBodyProfile, CreepWrapper } from "./creep-wrapper";
import { CreepUtils } from "creep-utils";
import { CreepRole } from "config/creep-types";
import { SockPuppetConstants } from "config/sockpuppet-constants";
import { profile } from "../../screeps-typescript-profiler";
import { CostMatrixUtils } from "utils/cost-matrix-utils";

@profile
export class Worker extends CreepWrapper {
  public static readonly ROLE = CreepRole.WORKER;
  public static readonly BODY_PROFILE: CreepBodyProfile = {
    profile: [WORK, MOVE, MOVE, CARRY],
    seed: [],
    maxBodyParts: MAX_CREEP_SIZE
  };

  public run(): void {
    // if target room, go there
    if (this.memory.targetRoom && this.pos.roomName !== this.memory.targetRoom) {
      const moveResult = this.moveTo(new RoomPosition(10, 10, this.memory.targetRoom));
      CreepUtils.consoleLogIfWatched(this, `moving to target room ${this.memory.targetRoom}`, moveResult);
      return;
    }

    // become a harvester if have haulers now
    const haulers = this.roomw.creeps.filter(c => c.memory.role === CreepRole.HAULER);
    if (this.roomw.controller?.level === 1 && haulers.length > 0) {
      this.memory.role = CreepRole.HARVESTER;
    }

    // harvest if any capacity in room
    if (this.room.energyAvailable < this.room.energyCapacityAvailable) {
      CreepUtils.consoleLogIfWatched(this, "harvesting job");
      this.doHarvestJob();
      return;
    }

    // supply tower if half empty
    const tower = this.findClosestTowerNotFull();
    if (tower) {
      const towerPercentFree = CreepUtils.getEnergyStoreRatioFree(tower);
      CreepUtils.consoleLogIfWatched(this, `towerPercentFree: ${towerPercentFree}`);
      if (this.memory.job === "supply" || towerPercentFree > 0.5) {
        CreepUtils.consoleLogIfWatched(this, "supply job");
        this.doSupplyJob();
        return;
      }
    }

    // build if anything to build
    if (this.roomw.constructionSites.length > 0) {
      CreepUtils.consoleLogIfWatched(this, "building job");
      this.doBuildJob();
      return;
    }

    const towerCount = this.roomw.towers.length;
    const repairSiteCount = this.roomw.repairSites.length;
    // repair if no towers to do it
    CreepUtils.consoleLogIfWatched(this, `towers: ${towerCount}, repair sites: ${repairSiteCount}`);
    if (towerCount === 0 && repairSiteCount > 0) {
      CreepUtils.consoleLogIfWatched(this, "repairing job");
      this.doRepairJob();
      return;
    }

    // otherwise upgrade
    CreepUtils.consoleLogIfWatched(this, "upgrading job");
    this.doUpgradeJob();
  }

  private doUpgradeJob(): void {
    if (this.room.controller) {
      const controller = this.room.controller;
      this.updateJob("upgrading");
      this.stopWorkingIfEmpty();
      this.startWorkingIfFull();
      this.startWorkingInRange(this.room.controller.pos);

      if (this.memory.working) {
        if (this.upgradeController(controller) === ERR_NOT_IN_RANGE) {
          this.moveTo(controller, { visualizePathStyle: { stroke: "#ffffff" } });
        }
      } else {
        this.harvestByPriority();
      }
    }
  }

  // TODO dry this up with builder code
  private doBuildJob(): void {
    const centerPos = this.findBuildCenterPos();
    const site = this.chooseConstructionSite(centerPos);

    if (site) {
      this.updateJob("building");
      this.stopWorkingIfEmpty();
      this.startWorkingIfFull();
      // TODO doesn't work well on first container
      // this.startWorkingInRange(site.pos);

      if (this.memory.working) {
        // don't block the source while working
        const closestEnergySource = this.findClosestActiveEnergySource();
        if (this.build(site) === ERR_NOT_IN_RANGE) {
          this.moveTo(site, {
            range: 3,
            visualizePathStyle: { stroke: "#ffffff" },
            costCallback: CostMatrixUtils.avoidHarvestPositionsCostCallback
          });
        } else if (closestEnergySource?.pos && this.pos.isNearTo(closestEnergySource)) {
          const path = PathFinder.search(this.pos, { pos: closestEnergySource.pos, range: 2 }, { flee: true });
          this.moveByPath(path.path);
        }
      } else {
        this.harvestByPriority();
      }
    }
  }

  private chooseConstructionSite(centerPos: RoomPosition) {
    let site: ConstructionSite | undefined;
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
    return site;
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

  private doRepairJob(): void {
    const site = this.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: structure => structure.hits < structure.hitsMax
    });
    if (site) {
      this.updateJob("repairing");
      this.stopWorkingIfEmpty();
      this.startWorkingIfFull();
      this.startWorkingInRange(site.pos);

      if (this.memory.working) {
        if (this.repair(site) === ERR_NOT_IN_RANGE) {
          this.moveTo(site, { visualizePathStyle: { stroke: "#ffffff" } });
        }
      } else {
        this.harvestByPriority();
      }
    }
  }

  private doHarvestJob(): void {
    this.updateJob("harvesting");
    this.stopWorkingIfEmpty();
    this.startWorkingIfFull();

    if (this.memory.working) {
      const spawnStorage = this.findSpawnStorageNotFull();
      if (spawnStorage) {
        const site = this.pos.findClosestByPath(spawnStorage);
        if (site) {
          if (this.transfer(site, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
            this.moveTo(site, { visualizePathStyle: { stroke: "#ffffff" } });
          }
        }
      }
    } else {
      this.harvestByPriority();
    }
  }

  private doSupplyJob(): void {
    this.updateJob("supply");
    this.stopWorkingIfEmpty();
    this.startWorkingIfFull();

    if (this.memory.working) {
      const site = this.findClosestTowerNotFull();
      if (site) {
        if (this.transfer(site, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
          this.moveTo(site, { visualizePathStyle: { stroke: "#ffffff" } });
        }
      } else {
        this.memory.job = "";
      }
    } else {
      this.harvestByPriority();
    }
  }
}
