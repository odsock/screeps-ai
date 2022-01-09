import { SockPuppetConstants } from "config/sockpuppet-constants";
import { StructurePatterns } from "config/structure-patterns";
import { TargetControl } from "control/target-control";
import { CreepUtils } from "creep-utils";
import { RoomWrapper } from "structures/room-wrapper";
import { profile } from "../../screeps-typescript-profiler";
import { ContainerPlan } from "./container-plan";
import { ExtensionPlan as ExtensionPlanner } from "./extension-plan";
import { MemoryUtils } from "./memory-utils";
import { PlannerUtils } from "./planner-utils";
import { RoadPlan as RoadPlanner } from "./road-plan";
import { StructurePlanPosition } from "./structure-plan";

@profile
export class Planner {
  private readonly targetControl: TargetControl;
  public constructor() {
    this.targetControl = TargetControl.getInstance();
  }

  public run(): void {
    // plan each room we can see
    _.forEach(Game.rooms, room => {
      const roomw = RoomWrapper.getInstance(room.name);
      console.log(`${roomw.name}: running planning`);

      if (this.targetControl.remoteHarvestRooms.includes(room.name)) {
        ContainerPlan.placeSourceContainers(roomw);
      } else if (roomw.controller?.my) {
        this.planColony(roomw);
      }
    });
  }

  private planColony(roomw: RoomWrapper) {
    if (roomw.controller) {
      const IGNORE_ROADS = true;
      if (roomw.controller?.level === 1) {
        this.createColonyPlan(roomw);
        this.updateColonyStructures(roomw, IGNORE_ROADS);
      } else if (roomw.controller?.level === 2) {
        this.createColonyPlan(roomw);
        this.updateColonyStructures(roomw, IGNORE_ROADS);
        this.planContainers(roomw);
        this.planRoads(roomw);
      } else if (roomw.controller?.level >= 3) {
        this.createColonyPlan(roomw);
        this.updateColonyStructures(roomw);
        this.planContainers(roomw);
        this.planRoads(roomw);
      }
    }
  }

  private createColonyPlan(roomw: RoomWrapper): StructurePlanPosition[] {
    const cacheKey = `${roomw.name}_plan`;
    let plan = MemoryUtils.getCache<StructurePlanPosition[]>(cacheKey);
    if (!plan && roomw.controller) {
      CreepUtils.consoleLogIfWatched(roomw, `no colony plan found, generating plan`);
      const controllerPos = roomw.controller.pos;
      const sourcePositions = roomw.sources.map(source => source.pos);
      const depositPositions = roomw.deposits.map(deposit => deposit.pos);
      const centerPoint = PlannerUtils.findMidpoint([controllerPos, ...sourcePositions, ...depositPositions]);
      roomw.memory.centerPoint = MemoryUtils.packRoomPosition(centerPoint);

      // find the best full colony placement
      plan = PlannerUtils.findSiteForPattern(StructurePatterns.FULL_COLONY, roomw, centerPoint, true);
      if (plan) {
        roomw.memory.colonyType = SockPuppetConstants.COLONY_TYPE_FULL;
      } else {
        plan = PlannerUtils.findSiteForPattern(StructurePatterns.SPAWN_GROUP, roomw, centerPoint, true);
        if (plan) {
          roomw.memory.colonyType = SockPuppetConstants.COLONY_TYPE_GROUP;
          const extensionPlan = this.planAvailableExtensionsByGroup(roomw);
          if (extensionPlan) {
            plan.push(...extensionPlan);
          }
        }
      }
    }

    if (plan) {
      console.log(`DEBUG: have a plan for ${roomw.name}`);
      // draw plan visual
      roomw.visual.clear();
      PlannerUtils.drawPlan(plan, roomw);
      roomw.planVisual = roomw.visual.export();

      // cache plan forever
      MemoryUtils.setCache(cacheKey, plan, -1);
      return plan;
    }
    console.log(`DEBUG: no plan for ${roomw.name}`);
    return [];
  }

  private updateColonyStructures(roomw: RoomWrapper, skipRoads = false): ScreepsReturnCode {
    const planPositions = MemoryUtils.getCache<StructurePlanPosition[]>(`${roomw.name}_plan`);
    if (!planPositions) {
      return OK;
    }

    // mark misplaced structures for dismantling
    this.createDismantleQueue(roomw, planPositions, skipRoads);

    // try to construct any missing structures
    const result = PlannerUtils.placeStructurePlan({
      planPositions,
      roomw,
      skipRoads
    });
    console.log(`place colony result ${result}`);

    return result;
  }

  private createDismantleQueue(roomw: RoomWrapper, planPositions: StructurePlanPosition[], skipRoads: boolean): void {
    const lastSpawn = roomw.find(FIND_MY_SPAWNS).length === 1;
    const dismantleQueue: Structure<StructureConstant>[] = [];
    planPositions.forEach(planPos => {
      const wrongStructure = roomw.lookForAt(LOOK_STRUCTURES, planPos).find(s => s.structureType !== planPos.structure);
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
    roomw.dismantleQueue = dismantleQueue;

    // draw dismantle queue
    roomw.visual.clear();
    roomw.dismantleQueue.forEach(structure => {
      roomw.visual.circle(structure.pos, { fill: "#FF0000" });
    });
    roomw.dismantleVisual = roomw.visual.export();
  }

  private planContainers(roomw: RoomWrapper): ScreepsReturnCode {
    // place source containers
    const sourceContainerResult = ContainerPlan.placeSourceContainers(roomw);
    if (sourceContainerResult !== OK) {
      return sourceContainerResult;
    }

    // place controller containers
    const controllerContainerResult = ContainerPlan.placeControllerContainer(roomw);
    return controllerContainerResult;
  }

  private planRoads(roomw: RoomWrapper): StructurePlanPosition[] {
    // place road from source containers to controller containers
    const roadPlan = new RoadPlanner(roomw);
    const containerRoadPlan = roadPlan.placeRoadSourceContainersToControllerContainers();
    if (containerRoadPlan.length === 0) {
      console.log(`ERROR: container road plan empty`);
    }

    // place road from controller to spawn
    const controllerRoadPlan = roadPlan.placeRoadControllerToSpawn();
    if (controllerRoadPlan.length === 0) {
      console.log(`ERROR: controller road plan empty`);
    }

    return [...containerRoadPlan, ...controllerRoadPlan];
  }

  public planAvailableExtensionsByGroup(roomw: RoomWrapper): StructurePlanPosition[] | undefined {
    // place available extensions
    const extensionPlanner = new ExtensionPlanner(roomw);
    const extensionPlan = extensionPlanner.planExtensionGroup();
    if (!extensionPlan) {
      return undefined;
    }

    // place roads to all extensions
    const roadPlanner = new RoadPlanner(roomw);
    const extensionRoadPlan = roadPlanner.placeRoadSpawnToExtensions();

    return [...extensionPlan, ...extensionRoadPlan];
  }

  private planTowers(roomw: RoomWrapper): ScreepsReturnCode {
    // place towers
    if (PlannerUtils.getAvailableStructureCount(STRUCTURE_TOWER, roomw) > 0) {
      const towerResult = PlannerUtils.placeTowerAtCenterOfColony(roomw);
      return towerResult;
    }
    return OK;
  }
}
