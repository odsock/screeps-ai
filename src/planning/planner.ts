import { SockPuppetConstants } from "config/sockpuppet-constants";
import { StructurePatterns } from "config/structure-patterns";
import { TargetControl } from "control/target-control";
import { CreepUtils, LogLevel } from "creep-utils";
import { RoomWrapper } from "structures/room-wrapper";
import { MemoryUtils } from "./memory-utils";
import { PlannerUtils } from "./planner-utils";
import { RoadPlan as RoadPlanner } from "./road-plan";
import { StructurePlan, StructurePlanPosition } from "./structure-plan";
import { profile } from "../../screeps-typescript-profiler";

@profile
export class Planner {
  private readonly targetControl: TargetControl;
  private readonly plannerUtils = PlannerUtils.getInstance();
  public constructor() {
    this.targetControl = TargetControl.getInstance();
  }

  public run(): void {
    // plan each room we can see
    _.forEach(Game.rooms, room => {
      const roomw = RoomWrapper.getInstance(room.name);
      console.log(`${roomw.name}: running planning`);

      let plan: StructurePlanPosition[] | undefined;
      if (this.targetControl.remoteHarvestRooms.includes(room.name)) {
        plan = this.planRemoteHarvestRoom(roomw);
      } else if (roomw.controller?.my) {
        plan = this.planColony(roomw);
      }

      if (plan) {
        this.updateColonyStructures(roomw, plan);
        this.drawPlan(roomw, plan);
      }
    });
  }

  private drawPlan(roomw: RoomWrapper, plan: StructurePlanPosition[]) {
    roomw.visual.clear();
    this.plannerUtils.drawPlan(roomw, plan);
    roomw.planVisual = roomw.visual.export();
  }

  private planRemoteHarvestRoom(roomw: RoomWrapper): StructurePlanPosition[] {
    const cacheKey = `${roomw.name}_plan`;
    const cachedPlan = MemoryUtils.getCache<StructurePlanPosition[]>(cacheKey);
    if (cachedPlan) {
      return cachedPlan;
    }
    CreepUtils.consoleLogIfWatched(roomw, `planning: no cached plan for remote ${roomw.name}`);

    let plan: StructurePlanPosition[] = [];
    const sourcePlan = this.planContainersAndLinks(roomw);
    if (sourcePlan) {
      plan = sourcePlan.getPlan();
    }
    MemoryUtils.setCache(cacheKey, plan, -1);
    return plan;
  }

  private planColony(roomw: RoomWrapper): StructurePlanPosition[] {
    if (!roomw.controller) throw new Error(`Planning colony in room without controller: ${roomw.name}`);

    const cacheKey = `${roomw.name}_plan`;
    const cachedPlan = MemoryUtils.getCache<StructurePlanPosition[]>(cacheKey);
    if (cachedPlan) {
      return cachedPlan;
    }
    CreepUtils.consoleLogIfWatched(roomw, `planning: no cached plan for colony ${roomw.name}`);

    const structurePlan = this.planContainersAndLinks(roomw);
    if (!structurePlan) {
      return [];
    }
    if (!this.createColonyPlan(roomw, structurePlan, cacheKey)) {
      return [];
    }

    const planPositions = structurePlan.getPlan();
    MemoryUtils.setCache(cacheKey, planPositions, -1);
    console.log(`DEBUG: have a plan for ${roomw.name}`);
    return planPositions;
  }

  private createColonyPlan(roomw: RoomWrapper, plan: StructurePlan, cacheKey: string): boolean {
    if (!roomw.controller) throw new Error("Planning colony in room without controller");

    const centerPoint = this.findRoomCenterPoint(roomw);

    // try full colony first
    if (!roomw.memory.colonyType || roomw.memory.colonyType === SockPuppetConstants.COLONY_TYPE_FULL) {
      if (this.createFullColonyPlan(roomw, plan, centerPoint, cacheKey)) {
        return true;
      }
    }

    // try groups colony next
    if (roomw.memory.colonyType === SockPuppetConstants.COLONY_TYPE_GROUP) {
      if (this.createGroupColonyPlan(roomw, plan, centerPoint, cacheKey)) {
        return true;
      }
    }

    return false;
  }

  private createGroupColonyPlan(
    roomw: RoomWrapper,
    plan: StructurePlan,
    centerPoint: RoomPosition,
    cacheKey: string
  ): boolean {
    let planOk = this.addPatternToPlan(
      plan,
      centerPoint,
      StructurePatterns.SPAWN_GROUP,
      `${cacheKey}_spawnGroupSearch`
    );
    const maxExtensions = CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][SockPuppetConstants.MAX_RCL];
    for (let i = 0; planOk && i < maxExtensions; i += 5) {
      planOk = this.addPatternToPlan(
        plan,
        centerPoint,
        StructurePatterns.EXTENSION_GROUP,
        `${cacheKey}_extensionGroupSearch`
      );
    }
    if (planOk) {
      planOk = this.addPatternToPlan(plan, centerPoint, StructurePatterns.LAB_GROUP, `${cacheKey}_labGroupSearch`);
    }
    return planOk;
  }

  private addPatternToPlan(roomPlan: StructurePlan, centerPoint: RoomPosition, pattern: string[], cacheKey: string) {
    roomPlan.setPattern(pattern);
    const patternPosition = this.plannerUtils.findSiteForPattern(roomPlan, centerPoint, cacheKey, true);
    if (patternPosition) {
      roomPlan.mergePatternAtPos(patternPosition);
      return true;
    }
    return false;
  }

  private createFullColonyPlan(
    roomw: RoomWrapper,
    plan: StructurePlan,
    centerPoint: RoomPosition,
    cacheKey: string
  ): StructurePlanPosition[] | undefined {
    const fullColonyPlan = new StructurePlan(roomw).setPattern(StructurePatterns.FULL_COLONY);
    const site = this.plannerUtils.findSiteForPattern(
      fullColonyPlan,
      centerPoint,
      `${cacheKey}_fullColonySearch`,
      true
    );
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
    const centerPoint = this.plannerUtils.findMidpoint(importantRoomPositions);
    roomw.memory.centerPoint = MemoryUtils.packRoomPosition(centerPoint);
    return centerPoint;
  }

  private updateColonyStructures(roomw: RoomWrapper, planPositions: StructurePlanPosition[]): ScreepsReturnCode {
    // mark misplaced structures for dismantling
    this.createDismantleQueue(roomw, planPositions);

    // try to construct any missing structures
    const result = this.plannerUtils.placeStructurePlan({
      room: roomw,
      planPositions
    });
    console.log(`place colony result ${result}`);

    return result;
  }

  private createDismantleQueue(roomw: RoomWrapper, planPositions: StructurePlanPosition[]): void {
    const lastSpawn = roomw.find(FIND_MY_SPAWNS).length === 1;
    const dismantleQueue: Structure<StructureConstant>[] = [];
    planPositions.forEach(planPos => {
      const wrongStructure = roomw.lookForAt(LOOK_STRUCTURES, planPos).find(s => s.structureType !== planPos.structure);
      if (wrongStructure) {
        // a couple of exceptions (don't dismantle own last spawn dummy)
        if (lastSpawn && wrongStructure.structureType === STRUCTURE_SPAWN) {
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
      const towerResult = this.plannerUtils.placeTowerAtCenterOfColony(roomw);
      return towerResult;
    }
    return OK;
  }

  private planContainersAndLinks(roomw: RoomWrapper): StructurePlan | undefined {
    const plan = new StructurePlan(roomw);
    for (const source of roomw.sources) {
      if (!this.planContainerAndLinkAtPosition(roomw, plan, source.pos)) {
        return undefined;
      }
    }
    if (roomw.controller) {
      if (!this.planContainerAndLinkAtPosition(roomw, plan, roomw.controller.pos)) {
        return undefined;
      }
    }
    return plan;
  }

  private planContainerAndLinkAtPosition(roomw: RoomWrapper, plan: StructurePlan, position: RoomPosition): boolean {
    const availableContainerPosition = this.plannerUtils.findAvailableAdjacentPosition(roomw, position);
    if (availableContainerPosition) {
      plan.setPlanPosition(availableContainerPosition, STRUCTURE_CONTAINER);
      const availableLinkPosition = this.plannerUtils.findAvailableAdjacentPosition(roomw, availableContainerPosition);
      if (availableLinkPosition) {
        plan.setPlanPosition(availableLinkPosition, STRUCTURE_LINK);
      } else {
        return false;
      }
    } else {
      return false;
    }
    return true;
  }
}
