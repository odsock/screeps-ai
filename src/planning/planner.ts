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
        // this.updateColonyStructures(roomw, plan);
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

    // add first spawn to plan if it exists to handle first room
    const initialPlan = new StructurePlan(roomw);
    if (roomw.spawns[0].pos) {
      initialPlan.setPlanPosition(roomw.spawns[0].pos, STRUCTURE_SPAWN);
    }

    const structurePlan = this.planContainersAndLinks(roomw, initialPlan);
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
    const extensionCenterPoint = roomw.spawns[0]?.pos ? roomw.spawns[0].pos : centerPoint;
    for (let i = 0; planOk && i < maxExtensions; i += 5) {
      planOk = this.addPatternToPlan(
        plan,
        extensionCenterPoint,
        StructurePatterns.EXTENSION_GROUP,
        `${cacheKey}_extensionGroupSearch_${i}`
      );
    }
    if (planOk) {
      planOk = this.addPatternToPlan(plan, centerPoint, StructurePatterns.LAB_GROUP, `${cacheKey}_labGroupSearch`);
    }
    return planOk;
  }

  private addPatternToPlan(roomPlan: StructurePlan, centerPoint: RoomPosition, pattern: string[], cacheKey: string) {
    roomPlan.setPattern(pattern);
    const patternPosition = this.plannerUtils.findSiteForPattern(roomPlan, centerPoint, cacheKey);
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
    const site = this.plannerUtils.findSiteForPattern(fullColonyPlan, centerPoint, `${cacheKey}_fullColonySearch`);
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

  private planContainersAndLinks(
    roomw: RoomWrapper,
    plan: StructurePlan = new StructurePlan(roomw)
  ): StructurePlan | undefined {
    for (const source of roomw.sources) {
      let sourceContainerPosition = this.findExistingSourceContainer(roomw, source);
      if (!sourceContainerPosition) {
        sourceContainerPosition = this.planContainerPosition(roomw, plan, source.pos);
      }
      if (sourceContainerPosition) {
        plan.setPlanPosition(sourceContainerPosition, STRUCTURE_CONTAINER);
        let sourceLinkPosition = this.findExistingSourceLink(roomw, source, sourceContainerPosition);
        if (!sourceLinkPosition) {
          sourceLinkPosition = this.planLinkPosition(roomw, plan, sourceContainerPosition);
        }
        if (sourceLinkPosition) {
          plan.setPlanPosition(sourceLinkPosition, STRUCTURE_LINK);
        }
      }
    }

    if (roomw.controller) {
      let controllerContainerPosition = this.findExistingControllerContainer(roomw.controller);
      if (!controllerContainerPosition) {
        controllerContainerPosition = this.planContainerPosition(roomw, plan, roomw.controller.pos);
      }
      if (controllerContainerPosition) {
        plan.setPlanPosition(controllerContainerPosition, STRUCTURE_CONTAINER);
        let controllerLinkPosition = this.findExistingControllerLink(roomw.controller, controllerContainerPosition);
        if (!controllerLinkPosition) {
          controllerLinkPosition = this.planLinkPosition(roomw, plan, controllerContainerPosition);
        }
        if (controllerLinkPosition) {
          plan.setPlanPosition(controllerLinkPosition, STRUCTURE_LINK);
        }
      }
    }

    return plan;
  }

  private planContainerPosition(
    roomw: RoomWrapper,
    plan: StructurePlan,
    position: RoomPosition
  ): RoomPosition | undefined {
    const AVOID_BOTTLENECK = true;
    const availableContainerPosition = this.plannerUtils.findAvailableAdjacentPosition(
      roomw,
      position,
      AVOID_BOTTLENECK
    );
    return availableContainerPosition;
  }

  private planLinkPosition(roomw: RoomWrapper, plan: StructurePlan, position: RoomPosition): RoomPosition | undefined {
    const AVOID_BOTTLENECK = true;
    const availableLinkPosition = this.plannerUtils.findAvailableAdjacentPosition(roomw, position, AVOID_BOTTLENECK);
    return availableLinkPosition;
  }

  private findExistingSourceContainer(roomw: RoomWrapper, source: Source): RoomPosition | undefined {
    const info = roomw.memory.sources[source.id].container;
    if (info && this.plannerUtils.validateStructureInfo(info) === OK) {
      return MemoryUtils.unpackRoomPosition(info.pos);
    }
    const findResult = this.plannerUtils.findAdjacentStructure<StructureContainer>(source.pos, STRUCTURE_CONTAINER);
    if (findResult) {
      roomw.memory.sources[source.id].container = {
        id: findResult.id,
        pos: MemoryUtils.packRoomPosition(findResult.pos),
        type: STRUCTURE_CONTAINER
      };
      return findResult.pos;
    }
    return undefined;
  }

  private findExistingSourceLink(
    roomw: RoomWrapper,
    source: Source,
    containerPos: RoomPosition
  ): RoomPosition | undefined {
    const info = roomw.memory.sources[source.id].link;
    if (info && this.plannerUtils.validateStructureInfo(info) === OK) {
      return MemoryUtils.unpackRoomPosition(info.pos);
    }
    const findResult = this.plannerUtils.findAdjacentStructure<StructureLink>(containerPos, STRUCTURE_LINK);
    if (findResult) {
      roomw.memory.sources[source.id].link = {
        id: findResult.id,
        pos: MemoryUtils.packRoomPosition(findResult.pos),
        type: STRUCTURE_LINK
      };
      return findResult.pos;
    }
    return undefined;
  }

  private findExistingControllerContainer(controller: StructureController): RoomPosition | undefined {
    const roomName = controller.room.name;
    const info = Memory.rooms[roomName].controller?.container;
    if (info && this.plannerUtils.validateStructureInfo(info) === OK) {
      return MemoryUtils.unpackRoomPosition(info.pos);
    }
    if (Memory.rooms[roomName].controller) {
      const findResult = this.plannerUtils.findAdjacentStructure<StructureContainer>(
        controller.pos,
        STRUCTURE_CONTAINER
      );
      if (findResult) {
        Memory.rooms[roomName].controller.container = {
          id: findResult.id,
          pos: MemoryUtils.packRoomPosition(findResult.pos),
          type: STRUCTURE_CONTAINER
        };
        return findResult.pos;
      }
    }
    return undefined;
  }

  private findExistingControllerLink(
    controller: StructureController,
    containerPos: RoomPosition
  ): RoomPosition | undefined {
    if (!controller.room.memory.controller) {
      return undefined;
    }
    const info = controller.room.memory.controller?.link;
    if (info && this.plannerUtils.validateStructureInfo(info) === OK) {
      return MemoryUtils.unpackRoomPosition(info.pos);
    }
    const findResult = this.plannerUtils.findAdjacentStructure<StructureLink>(containerPos, STRUCTURE_LINK);
    if (findResult && controller.room.memory.controller) {
      controller.room.memory.controller.link = {
        id: findResult.id,
        pos: MemoryUtils.packRoomPosition(findResult.pos),
        type: STRUCTURE_LINK
      };
      return findResult.pos;
    }
    return undefined;
  }
}
