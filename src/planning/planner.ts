import { RoomWrapper } from "structures/room-wrapper";
import { ContainerPlan } from "./container-plan";
import { RoadPlan } from "./road-plan";
import { PlannerUtils } from "./planner-utils";
import { MemoryUtils } from "./memory-utils";
import { CreepUtils } from "creep-utils";
import { StructurePatterns } from "config/structure-patterns";
import { StructurePlan } from "./structure-plan";
import { SockPuppetConstants } from "config/sockpuppet-constants";

export class Planner {
  private readonly roomw: RoomWrapper;

  public constructor(room: Room) {
    this.roomw = RoomWrapper.getInstance(room.name);
  }

  public run(): ScreepsReturnCode {
    console.log(`${this.roomw.name}: running planning`);

    if (this.roomw.controller) {
      if (this.roomw.controller?.level >= 1) {
        const result1 = this.planLevel1();
        this.planFullColony();
        this.assimilateColonlyToPlan(true);
        CreepUtils.consoleLogIfWatched(this.roomw, `level 1 planning result`, result1);
      }

      if (this.roomw.controller?.level >= 2) {
        const result2 = this.planLevel2();
        this.planFullColony();
        this.assimilateColonlyToPlan(true);
        CreepUtils.consoleLogIfWatched(this.roomw, `level 2 planning result`, result2);
      }

      if (this.roomw.controller?.level >= 3) {
        this.planFullColony();
        this.assimilateColonlyToPlan();
      }
    }
    return OK;
  }

  private planFullColony(): void {
    let plan = MemoryUtils.getCache<StructurePlan>(`${this.roomw.name}_plan`);
    if (!plan) {
      const controllerPos = this.roomw.controller?.pos;
      if (controllerPos) {
        const sourcePositions = this.roomw.sources.map(source => source.pos);
        const depositPositions = this.roomw.deposits.map(deposit => deposit.pos);

        // find the best colony placement
        const centerPoint = PlannerUtils.findMidpoint([controllerPos, ...sourcePositions, ...depositPositions]);
        plan = PlannerUtils.findSiteForPattern(StructurePatterns.FULL_COLONY, this.roomw, centerPoint, true);

        // draw plan visual
        this.roomw.visual.clear();
        this.roomw.visual.circle(centerPoint.x, centerPoint.y, { fill: "#FF0000" });
        plan.drawPattern();
        this.roomw.planVisual = this.roomw.visual.export();

        // cache plan
        // TODO put this in room wrapper
        MemoryUtils.setCache(`${this.roomw.name}_plan`, plan, SockPuppetConstants.PLANNING_INTERVAL);
        MemoryUtils.setCache(`${this.roomw.name}_centerPoint`, centerPoint, SockPuppetConstants.PLANNING_INTERVAL);
      }
    }
  }

  private assimilateColonlyToPlan(skipRoads = false): ScreepsReturnCode {
    const plan = MemoryUtils.getCache<StructurePlan>(`${this.roomw.name}_plan`);
    if (!plan) {
      return OK;
    }

    const planPositions = plan.getPlan();
    if (!planPositions) {
      return OK;
    }

    // mark each structure for dismantling if mismatch found
    const roomLook = this.roomw.lookForAtArea(LOOK_STRUCTURES, 0, 0, SockPuppetConstants.ROOM_SIZE, SockPuppetConstants.ROOM_SIZE);
    planPositions.forEach(planPos => {
      const posLook = roomLook[planPos.pos.x][planPos.pos.y];
      if (posLook) {
        const wrongStructure = posLook.find(s => s.structure.structureType !== planPos.structure);
        if (wrongStructure?.structure && wrongStructure.structure) {
          // a couple of exceptions
          if (
            (skipRoads && wrongStructure.structure.structureType === STRUCTURE_ROAD) ||
            (wrongStructure.structure.structureType === STRUCTURE_SPAWN && this.roomw.find(FIND_MY_SPAWNS).length === 1)
          ) {
            return;
          }
          // add item to queue if not already there
          const dismantleQueue = this.roomw.dismantleQueue;
          if (!dismantleQueue.find(item => item.id === wrongStructure.structure?.id)) {
            console.log(
              `DISMANTLE ${String(wrongStructure.structure.structureType)} at ${String(wrongStructure.structure.pos)}`
            );
            dismantleQueue.push(wrongStructure.structure);
          }
        }
      }
    });

    // draw dismantle queue
    this.roomw.visual.clear();
    this.roomw.dismantleQueue.forEach(structure => {
      this.roomw.visual.circle(structure.pos, { fill: "#FF0000" });
    });
    this.roomw.dismantleVisual = this.roomw.visual.export();

    // try to construct any missing structures
    const result = PlannerUtils.placeStructurePlan(plan, true, true, skipRoads);
    console.log(`place colony result ${result}`);

    return result;
  }

  private planLevel1(): ScreepsReturnCode {
    return OK;
  }

  private planLevel2(): ScreepsReturnCode {
    // place available extensions
    // const extensionPlan = new ExtensionPlan(this.room);
    // const extensionResult = extensionPlan.planExtensionGroup();
    // if (extensionResult !== OK) {
    //   return extensionResult;
    // }

    // place source containers
    const containerPlan = new ContainerPlan(this.roomw);
    const sourceContainerResult = containerPlan.placeSourceContainer();
    if (sourceContainerResult !== OK) {
      return sourceContainerResult;
    }

    // place controller containers
    const controllerContainerResult = containerPlan.placeControllerContainer();
    if (controllerContainerResult !== OK) {
      return controllerContainerResult;
    }

    // place road from source containers to controller containers
    const roadPlan = new RoadPlan(this.roomw);
    const containerRoadResult = roadPlan.placeRoadSourceContainersToControllerContainers();
    if (containerRoadResult !== OK) {
      return containerRoadResult;
    }

    // place roads to all extensions
    // const extensionRoadResult = roadPlan.placeRoadSpawnToExtensions();
    // if (extensionRoadResult !== OK) {
    //   return extensionRoadResult;
    // }

    // place road from controller to spawn
    const controllerRoadResult = roadPlan.placeRoadControllerToSpawn();
    if (controllerRoadResult !== OK) {
      return controllerRoadResult;
    }

    // // place towers
    // if (PlannerUtils.getAvailableStructureCount(STRUCTURE_TOWER, this.roomw) > 0) {
    //   const towerResult = PlannerUtils.placeTowerAtCenterOfColony(this.roomw);
    //   if (towerResult !== OK) {
    //     return towerResult;
    //   }
    // }

    // TODO: place ramparts over containers
    return OK;
  }
}
