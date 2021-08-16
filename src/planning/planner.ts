import { RoomWrapper } from "structures/room-wrapper";
import { ContainerPlan } from "./container-plan";
import { ExtensionPlan } from "./extension-plan";
import { RoadPlan } from "./road-plan";
import { PlannerUtils } from "./planner-utils";
import { MemoryUtils } from "./memory-utils";
import { CreepUtils } from "creep-utils";
import { StructurePatterns } from "structure-patterns";
import { StructurePlan } from "./structure-plan";

export class Planner {
  private readonly room: RoomWrapper;

  public constructor(room: Room) {
    this.room = new RoomWrapper(room);
  }

  public run(): ScreepsReturnCode {
    console.log(`${this.room.name}: running planning`);
    MemoryUtils.refreshRoomMemory(this.room);

    this.planFullColony();
    this.assimilateColonlyToPlan();

    if (this.room.controller) {
      if (this.room.controller?.level >= 1) {
        const result1 = this.planLevel1();
        CreepUtils.consoleLogResultIfWatched(this.room, `level 1 planning result`, result1);
      }

      if (this.room.controller?.level >= 2) {
        const result2 = this.planLevel2();
        CreepUtils.consoleLogResultIfWatched(this.room, `level 2 planning result`, result2);
      }
    }
    return OK;
  }

  private planFullColony(): void {
    let plan: StructurePlan = MemoryUtils.getCache<StructurePlan>(`${this.room.name}_plan`);
    if (!plan) {
      const controllerPos = this.room.controller?.pos;
      if (controllerPos) {
        console.log("POC colonly layout");
        const sourcePositions = this.room.sources.map(source => source.pos);
        const depositPositions = this.room.deposits.map(deposit => deposit.pos);

        // find the best colony placement
        const centerPoint = PlannerUtils.findMidpoint([controllerPos, ...sourcePositions, ...depositPositions]);
        plan = PlannerUtils.findSiteForPattern(StructurePatterns.FULL_COLONY, this.room, centerPoint, true);

        // draw plan visual
        this.room.visual.clear();
        this.room.memory.visualString = undefined;
        this.room.visual.circle(centerPoint.x, centerPoint.y, { fill: "#FF0000" });
        plan.drawPattern();

        // cache plan
        MemoryUtils.setCache(`${this.room.name}_plan`, plan);
        MemoryUtils.setCache(`${this.room.name}_centerPoint`, centerPoint);
        MemoryUtils.setCache(`${this.room.name}_planVisual`, this.room.visual.export());
      }
    }
  }

  private assimilateColonlyToPlan(): ScreepsReturnCode {
    const plan = MemoryUtils.getCache<StructurePlan>(`${this.room.name}_plan`);
    if (!plan) {
      return OK;
    }

    const planPositions = plan.getPlan();
    if (!planPositions) {
      return OK;
    }

    let result: ScreepsReturnCode = OK;
    planPositions.some(planPos => {
      const posLook = planPos.pos.look();
      const wrongStructure = posLook.find(
        lookResult => lookResult.structure?.structureType && lookResult.structure.structureType !== planPos.structure
      );

      if (wrongStructure?.structure) {
        console.log(
          `DISASSEMBLE ${String(wrongStructure.structure.structureType)} at ${String(wrongStructure.structure.pos)}`
        );
        result = ERR_FULL;
      }
      return !!wrongStructure;
    });

    return result;
  }

  private planLevel1(): ScreepsReturnCode {
    if (this.room.find(FIND_MY_SPAWNS).length === 0) {
      return PlannerUtils.placeFirstSpawn(this.room);
    }
    return OK;
  }

  private planLevel2(): ScreepsReturnCode {
    // place available extensions
    const extensionPlan = new ExtensionPlan(this.room);
    const extensionResult = extensionPlan.planExtensionGroup();
    if (extensionResult !== OK) {
      return extensionResult;
    }

    // place source containers
    const containerPlan = new ContainerPlan(this.room);
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
    const roadPlan = new RoadPlan(this.room);
    const containerRoadResult = roadPlan.placeRoadSourceContainersToControllerContainers();
    if (containerRoadResult !== OK) {
      return containerRoadResult;
    }

    // place roads to all extensions
    const extensionRoadResult = roadPlan.placeRoadSpawnToExtensions();
    if (extensionRoadResult !== OK) {
      return extensionRoadResult;
    }

    // place road from controller to spawn
    const controllerRoadResult = roadPlan.placeRoadControllerToSpawn();
    if (controllerRoadResult !== OK) {
      return controllerRoadResult;
    }

    // place towers
    if (PlannerUtils.getAvailableStructureCount(STRUCTURE_TOWER, this.room) > 0) {
      const towerResult = PlannerUtils.placeTowerAtCenterOfColony(this.room);
      if (towerResult !== OK) {
        return towerResult;
      }
    }

    // TODO: place ramparts over containers
    return OK;
  }
}
