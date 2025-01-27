import { SockPuppetConstants } from "config/sockpuppet-constants";
import { StructurePatterns } from "config/structure-patterns";
import { TargetControl } from "control/target-control";
import { CreepUtils, LogLevel } from "creep-utils";
import { RoomWrapper } from "structures/room-wrapper";
import { ControllerPlan } from "./controller-plan";
import { MemoryUtils } from "./memory-utils";
import { PlannerUtils } from "./planner-utils";
import { RoadPlan as RoadPlanner } from "./road-plan";
import { StructurePlan, StructurePlanPosition } from "./structure-plan";
import { SourcePlan } from "./source-plan";
import { profile } from "../../screeps-typescript-profiler";

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
        new SourcePlan(roomw).run();
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
        // this.updateColonyStructures(roomw, IGNORE_ROADS);
      } else if (roomw.controller?.level === 2) {
        this.createColonyPlan(roomw);
        // this.updateColonyStructures(roomw, IGNORE_ROADS);
        new SourcePlan(roomw).run();
        new ControllerPlan(roomw).run();
        // this.planRoads(roomw);
      } else if (roomw.controller?.level >= 3) {
        this.createColonyPlan(roomw);
        // this.updateColonyStructures(roomw);
        new SourcePlan(roomw).run();
        new ControllerPlan(roomw).run();
        // this.planRoads(roomw);
      }
    }
  }

  private createColonyPlan(roomw: RoomWrapper): StructurePlanPosition[] {
    if (!roomw.controller) throw new Error("Planning colony in room without controller");
    const plannerUtils = new PlannerUtils(roomw);
    const cacheKey = `${roomw.name}_plan`;
    let plan = MemoryUtils.getCache<StructurePlanPosition[]>(cacheKey);
    if (!plan) {
      CreepUtils.consoleLogIfWatched(roomw, `planning: no cached plan for ${cacheKey}`);
      const centerPoint = this.findRoomCenterPoint(roomw);

      // try full colony first
      if (!roomw.memory.colonyType || roomw.memory.colonyType === SockPuppetConstants.COLONY_TYPE_FULL) {
        plan = this.createFullColonyPlan(roomw, centerPoint, cacheKey);
      }

      // try groups colony next
      if (!plan || roomw.memory.colonyType === SockPuppetConstants.COLONY_TYPE_GROUP) {
        plan = this.createGroupColonyPlan(roomw, centerPoint, cacheKey);
      }
    }

    if (plan) {
      console.log(`DEBUG: have a plan for ${roomw.name}`);
      // draw plan visual
      roomw.visual.clear();
      plannerUtils.drawPlan(plan);
      roomw.planVisual = roomw.visual.export();
      return plan;
    }
    console.log(`DEBUG: no plan for ${roomw.name}`);
    return [];
  }

  private createGroupColonyPlan(
    roomw: RoomWrapper,
    centerPoint: RoomPosition,
    cacheKey: string
  ): StructurePlanPosition[] | undefined {
    const roomPlan = new StructurePlan(roomw);
    let planOkSoFar = this.addPatternToPlan(
      roomPlan,
      centerPoint,
      StructurePatterns.SPAWN_GROUP,
      `${cacheKey}_spawnGroupSearch`
    );
    if (!planOkSoFar) {
      return [];
    }

    const maxExtensions = CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][SockPuppetConstants.MAX_RCL];
    for (let i = 0; planOkSoFar && i < maxExtensions; i += 5) {
      planOkSoFar = this.addPatternToPlan(
        roomPlan,
        centerPoint,
        StructurePatterns.EXTENSION_GROUP,
        `${cacheKey}_extensionGroupSearch`
      );
    }
    if (planOkSoFar) {
      planOkSoFar = this.addPatternToPlan(
        roomPlan,
        centerPoint,
        StructurePatterns.LAB_GROUP,
        `${cacheKey}_labGroupSearch`
      );
    }

    if (planOkSoFar) {
      const plan = roomPlan.getPlan();
      MemoryUtils.setCache(cacheKey, plan, -1);
      return plan;
    }
    return undefined;
  }

  private addPatternToPlan(roomPlan: StructurePlan, centerPoint: RoomPosition, pattern: string[], cacheKey: string) {
    const plannerUtils = new PlannerUtils(centerPoint.roomName);
    roomPlan.setPattern(pattern);
    const patternPosition = plannerUtils.findSiteForPattern(roomPlan, centerPoint, cacheKey, true);
    if (patternPosition) {
      roomPlan.mergePatternAtPos(patternPosition);
      return true;
    }
    return false;
  }

  private createFullColonyPlan(
    roomw: RoomWrapper,
    centerPoint: RoomPosition,
    cacheKey: string
  ): StructurePlanPosition[] | undefined {
    const plannerUtils = new PlannerUtils(roomw);
    const fullColonyPlan = new StructurePlan(roomw).setPattern(StructurePatterns.FULL_COLONY);
    const site = plannerUtils.findSiteForPattern(fullColonyPlan, centerPoint, `${cacheKey}_fullColonySearch`, true);
    if (site) {
      roomw.memory.colonyType = SockPuppetConstants.COLONY_TYPE_FULL;
      fullColonyPlan.mergePatternAtPos(site);
      const plan = fullColonyPlan.getPlan();
      MemoryUtils.setCache(cacheKey, plan, -1);
      return plan;
    } else {
      roomw.memory.colonyType = SockPuppetConstants.COLONY_TYPE_GROUP;
      return undefined;
    }
  }

  /** Finds central point of important features in a room. Uses value from room memory if possible. */
  private findRoomCenterPoint(roomw: RoomWrapper) {
    if (roomw.memory.centerPoint) {
      return MemoryUtils.unpackRoomPosition(roomw.memory.centerPoint);
    }
    const importantRoomPositions: RoomPosition[] = [];
    if (roomw.controller) {
      importantRoomPositions.push(roomw.controller.pos);
    }
    importantRoomPositions.push(...roomw.sources.map(source => source.pos));
    importantRoomPositions.push(...roomw.deposits.map(deposit => deposit.pos));
    const plannerUtils = new PlannerUtils(roomw);
    const centerPoint = plannerUtils.findMidpoint(importantRoomPositions);
    roomw.memory.centerPoint = MemoryUtils.packRoomPosition(centerPoint);
    return centerPoint;
  }

  private updateColonyStructures(roomw: RoomWrapper, skipRoads = false): ScreepsReturnCode {
    const planPositions = MemoryUtils.getCache<StructurePlanPosition[]>(`${roomw.name}_plan`);
    if (!planPositions) {
      return OK;
    }

    // mark misplaced structures for dismantling
    this.createDismantleQueue(roomw, planPositions, skipRoads);

    // try to construct any missing structures
    const plannerUtils = new PlannerUtils(roomw);
    const result = plannerUtils.placeStructurePlan({
      planPositions,
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

  private planRoads(roomw: RoomWrapper): StructurePlanPosition[] {
    // place road from source containers to controller containers
    const roadPlan = new RoadPlanner(roomw);
    const containerRoadPlan = roadPlan.placeRoadSourceContainersToControllerContainers();
    if (containerRoadPlan.length === 0) {
      CreepUtils.log(LogLevel.DEBUG, `container road plan empty`);
    }

    // place road from controller to spawn
    const controllerRoadPlan = roadPlan.placeRoadControllerToSpawn();
    if (controllerRoadPlan.length === 0) {
      CreepUtils.log(LogLevel.DEBUG, `controller road plan empty`);
    }

    // place roads to all extensions
    const roadPlanner = new RoadPlanner(roomw);
    const extensionRoadPlan = roadPlanner.placeRoadSpawnToExtensions();

    return [...containerRoadPlan, ...controllerRoadPlan, ...extensionRoadPlan];
  }

  private planTowers(roomw: RoomWrapper): ScreepsReturnCode {
    // place towers
    if (roomw.getAvailableStructureCount(STRUCTURE_TOWER) > 0) {
      const plannerUtils = new PlannerUtils(roomw);
      const towerResult = plannerUtils.placeTowerAtCenterOfColony();
      return towerResult;
    }
    return OK;
  }
}
