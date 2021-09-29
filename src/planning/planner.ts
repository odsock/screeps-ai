import { RoomWrapper } from "structures/room-wrapper";
import { ContainerPlan } from "./container-plan";
import { RoadPlan } from "./road-plan";
import { PlannerUtils } from "./planner-utils";
import { MemoryUtils } from "./memory-utils";
import { StructurePatterns } from "config/structure-patterns";
import { StructurePlan } from "./structure-plan";
import { SockPuppetConstants } from "config/sockpuppet-constants";
import { ExtensionPlan } from "./extension-plan";
import { CreepUtils } from "creep-utils";

export class Planner {
  private readonly roomw: RoomWrapper;

  public constructor(room: Room) {
    this.roomw = RoomWrapper.getInstance(room.name);
  }

  public run(): ScreepsReturnCode {
    console.log(`${this.roomw.name}: running planning`);

    if (this.roomw.controller) {
      const IGNORE_ROADS = true;
      if (this.roomw.controller?.level === 1) {
        this.planFullColony();
        this.assimilateColonlyToPlan(IGNORE_ROADS);
      } else if (this.roomw.controller?.level === 2) {
        this.planFullColony();
        this.assimilateColonlyToPlan(IGNORE_ROADS);
        this.planContainers();
        this.planRoads();
      } else if (this.roomw.controller?.level >= 3) {
        this.planFullColony();
        this.assimilateColonlyToPlan();
        this.planContainers();
        this.planRoads();
      }
    }
    return OK;
  }

  private planFullColony(): void {
    const cpu = Game.cpu.getUsed();
    let plan = MemoryUtils.getCache<StructurePlan>(`${this.roomw.name}_plan`);
    if (!plan) {
      const controllerPos = this.roomw.controller?.pos;
      if (controllerPos) {
        const sourcePositions = this.roomw.sources.map(source => source.pos);
        const depositPositions = this.roomw.deposits.map(deposit => deposit.pos);

        // find the best colony placement
        const centerPoint = PlannerUtils.findMidpoint([controllerPos, ...sourcePositions, ...depositPositions]);
        this.roomw.memory.centerPoint = MemoryUtils.packRoomPosition(centerPoint);
        plan = PlannerUtils.findSiteForPattern(StructurePatterns.FULL_COLONY, this.roomw, centerPoint, true);

        // draw plan visual
        this.roomw.visual.clear();
        this.roomw.visual.circle(centerPoint.x, centerPoint.y, { fill: "#FF0000" });
        plan.drawPattern();
        this.roomw.planVisual = this.roomw.visual.export();

        // cache plan forever
        MemoryUtils.setCache(`${this.roomw.name}_plan`, plan, -1);
      }
    }
    CreepUtils.profile(this.roomw, `plan colony`, cpu);
  }

  private assimilateColonlyToPlan(skipRoads = false): ScreepsReturnCode {
    const cpu = Game.cpu.getUsed();
    const plan = MemoryUtils.getCache<StructurePlan>(`${this.roomw.name}_plan`);
    if (!plan) {
      return OK;
    }

    const planPositions = plan.getPlan();
    if (!planPositions) {
      return OK;
    }

    // mark each structure for dismantling if mismatch found
    const dismantleQueue: Structure<StructureConstant>[] = [];
    const roomLook = this.roomw.lookForAtArea(
      LOOK_STRUCTURES,
      0,
      0,
      SockPuppetConstants.ROOM_SIZE,
      SockPuppetConstants.ROOM_SIZE
    );
    planPositions.forEach(planPos => {
      const posLook = roomLook[planPos.pos.x][planPos.pos.y];
      if (posLook) {
        const wrongStructure = posLook.find(s => s.structure.structureType !== planPos.structure);
        if (wrongStructure?.structure && wrongStructure.structure) {
          // a couple of exceptions (don't dismantle own last spawn dummy)
          if (
            (skipRoads && wrongStructure.structure.structureType === STRUCTURE_ROAD) ||
            (wrongStructure.structure.structureType === STRUCTURE_SPAWN && this.roomw.find(FIND_MY_SPAWNS).length === 1)
          ) {
            return;
          }
          console.log(
            `DISMANTLE ${String(wrongStructure.structure.structureType)} at ${String(wrongStructure.structure.pos)}`
          );
          dismantleQueue.push(wrongStructure.structure);
        }
      }
    });
    this.roomw.dismantleQueue = dismantleQueue;

    // draw dismantle queue
    this.roomw.visual.clear();
    this.roomw.dismantleQueue.forEach(structure => {
      this.roomw.visual.circle(structure.pos, { fill: "#FF0000" });
    });
    this.roomw.dismantleVisual = this.roomw.visual.export();

    // try to construct any missing structures
    const result = PlannerUtils.placeStructurePlan(plan, true, true, skipRoads);
    console.log(`place colony result ${result}`);

    CreepUtils.profile(this.roomw, `assimilate colony`, cpu);
    return result;
  }

  private planContainers(): ScreepsReturnCode {
    // place source containers
    const containerPlan = new ContainerPlan(this.roomw);
    const sourceContainerResult = containerPlan.placeSourceContainer();
    if (sourceContainerResult !== OK) {
      return sourceContainerResult;
    }

    // place controller containers
    const controllerContainerResult = containerPlan.placeControllerContainer();
    return controllerContainerResult;
  }

  private planRoads(): ScreepsReturnCode {
    // place road from source containers to controller containers
    const roadPlan = new RoadPlan(this.roomw);
    const containerRoadResult = roadPlan.placeRoadSourceContainersToControllerContainers();
    if (containerRoadResult !== OK) {
      return containerRoadResult;
    }

    // place road from controller to spawn
    const controllerRoadResult = roadPlan.placeRoadControllerToSpawn();
    return controllerRoadResult;
  }

  private planAvailableExtensionsByGroup(): ScreepsReturnCode {
    // place available extensions
    const extensionPlan = new ExtensionPlan(this.roomw);
    const extensionResult = extensionPlan.planExtensionGroup();
    if (extensionResult !== OK) {
      return extensionResult;
    }

    // place roads to all extensions
    const roadPlan = new RoadPlan(this.roomw);
    const extensionRoadResult = roadPlan.placeRoadSpawnToExtensions();
    return extensionRoadResult;
  }

  private planTowers(): ScreepsReturnCode {
    // // place towers
    if (PlannerUtils.getAvailableStructureCount(STRUCTURE_TOWER, this.roomw) > 0) {
      const towerResult = PlannerUtils.placeTowerAtCenterOfColony(this.roomw);
      return towerResult;
    }
    return OK;
  }
}
