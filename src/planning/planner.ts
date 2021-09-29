import { RoomWrapper } from "structures/room-wrapper";
import { ContainerPlan } from "./container-plan";
import { RoadPlan } from "./road-plan";
import { PlannerUtils } from "./planner-utils";
import { MemoryUtils } from "./memory-utils";
import { StructurePatterns } from "config/structure-patterns";
import { StructurePlanPosition } from "./structure-plan";
import { ExtensionPlan } from "./extension-plan";
import { CreepUtils } from "creep-utils";

export class Planner {
  private readonly roomw: RoomWrapper;
  private readonly CACHE_KEY;

  public constructor(room: Room) {
    this.roomw = RoomWrapper.getInstance(room.name);
    this.CACHE_KEY = `${this.roomw.name}_plan`;
  }

  public run(): ScreepsReturnCode {
    console.log(`${this.roomw.name}: running planning`);

    if (this.roomw.controller) {
      const IGNORE_ROADS = true;
      if (this.roomw.controller?.level === 1) {
        this.planFullColony();
        this.updateColonyStructures(IGNORE_ROADS);
      } else if (this.roomw.controller?.level === 2) {
        this.planFullColony();
        this.updateColonyStructures(IGNORE_ROADS);
        this.planContainers();
        this.planRoads();
      } else if (this.roomw.controller?.level >= 3) {
        this.planFullColony();
        this.updateColonyStructures();
        this.planContainers();
        this.planRoads();
      }
    }
    return OK;
  }

  private planFullColony(): void {
    const cpu = Game.cpu.getUsed();
    if (!MemoryUtils.hasCache(this.CACHE_KEY)) {
      const controllerPos = this.roomw.controller?.pos;
      if (controllerPos) {
        const sourcePositions = this.roomw.sources.map(source => source.pos);
        const depositPositions = this.roomw.deposits.map(deposit => deposit.pos);

        // find the best colony placement
        const centerPoint = PlannerUtils.findMidpoint([controllerPos, ...sourcePositions, ...depositPositions]);
        this.roomw.memory.centerPoint = MemoryUtils.packRoomPosition(centerPoint);
        const plan = PlannerUtils.findSiteForPattern(StructurePatterns.FULL_COLONY, this.roomw, centerPoint, true);

        // draw plan visual
        this.roomw.visual.clear();
        this.roomw.visual.circle(centerPoint.x, centerPoint.y, { fill: "#FF0000" });
        plan.drawPattern();
        this.roomw.planVisual = this.roomw.visual.export();

        // cache plan forever
        MemoryUtils.setCache(this.CACHE_KEY, plan.getPlan(), -1);
      }
    }
    CreepUtils.profile(this.roomw, `plan colony`, cpu);
  }

  private updateColonyStructures(skipRoads = false): ScreepsReturnCode {
    const cpuBefore = Game.cpu.getUsed();
    const planPositions = MemoryUtils.getCache<StructurePlanPosition[]>(this.CACHE_KEY);
    if (!planPositions) {
      return OK;
    }
    CreepUtils.profile(this.roomw, `get plan`, cpuBefore);

    // mark misplaced structures for dismantling
    this.createDismantleQueue(planPositions, skipRoads);

    // try to construct any missing structures
    const cpu = Game.cpu.getUsed();
    const result = PlannerUtils.placeStructurePlan(planPositions, this.roomw, true, true, skipRoads);
    console.log(`place colony result ${result}`);
    CreepUtils.profile(this.roomw, `place colony`, cpu);

    CreepUtils.profile(this.roomw, `assimilate colony`, cpuBefore);
    return result;
  }

  private createDismantleQueue(planPositions: StructurePlanPosition[], skipRoads: boolean): void {
    let cpu = Game.cpu.getUsed();
    const lastSpawn = this.roomw.find(FIND_MY_SPAWNS).length === 1;
    const dismantleQueue: Structure<StructureConstant>[] = [];
    planPositions.forEach(planPos => {
      const wrongStructure = this.roomw
        .lookForAt(LOOK_STRUCTURES, planPos)
        .find(s => s.structureType !== planPos.structure);
      if (wrongStructure) {
        // a couple of exceptions (don't dismantle own last spawn dummy)
        if (
          (skipRoads && wrongStructure.structureType === STRUCTURE_ROAD) ||
          (lastSpawn && wrongStructure.structureType === STRUCTURE_SPAWN)
        ) {
          return;
        }
        console.log(`DISMANTLE ${String(wrongStructure.structureType)} at ${String(wrongStructure.pos)}`);
        dismantleQueue.push(wrongStructure);
      }
    });
    this.roomw.dismantleQueue = dismantleQueue;
    CreepUtils.profile(this.roomw, `build dismantle queue`, cpu);

    // draw dismantle queue
    cpu = Game.cpu.getUsed();
    this.roomw.visual.clear();
    this.roomw.dismantleQueue.forEach(structure => {
      this.roomw.visual.circle(structure.pos, { fill: "#FF0000" });
    });
    this.roomw.dismantleVisual = this.roomw.visual.export();
    CreepUtils.profile(this.roomw, `draw dismantle visual`, cpu);
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
