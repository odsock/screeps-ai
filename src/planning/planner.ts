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
  private readonly targetControl = TargetControl.getInstance();
  private readonly plannerUtils = PlannerUtils.getInstance();

  private structurePlan: StructurePlan;
  private planPositions: StructurePlanPosition[] = [];
  private readonly cacheKey: string;
  private sourceContainerPositions: RoomPosition[] = [];
  private controllerContainerPosition: RoomPosition | undefined;

  public constructor(private readonly roomw: RoomWrapper) {
    this.cacheKey = `${this.roomw.name}_plan`;
    this.structurePlan = new StructurePlan(roomw);
  }

  public run(): void {
    this.planPositions = this.getCachedPlan();
    if (this.planPositions.length === 0) {
      if (this.targetControl.remoteHarvestRooms.includes(this.roomw.name)) {
        if (
          this.planSourceContainersAndLinks() &&
          this.planControllerContainerAndLink() &&
          this.planRoads()
        ) {
          this.planPositions = this.structurePlan.getPlan();
        }
      } else if (this.roomw.controller?.my && this.planColony() && this.planRoads()) {
        this.planPositions = this.structurePlan.getPlan();
      }
    }

    if (this.planPositions.length > 0) {
      this.setCachedPlan();
      // this.updateColonyStructures(roomw, plan);
      this.drawPlan(this.planPositions);
    }
  }

  private setCachedPlan(): void {
    CreepUtils.consoleLogIfWatched(this.roomw, `planning: caching plan for ${this.roomw.name}`);
    MemoryUtils.setCache(this.cacheKey, this.planPositions, -1);
  }

  private getCachedPlan(): StructurePlanPosition[] {
    const cachedPlan = MemoryUtils.getCache<StructurePlanPosition[]>(this.cacheKey);
    if (cachedPlan) {
      CreepUtils.consoleLogIfWatched(
        this.roomw,
        `planning: found cached plan for ${this.roomw.name}`
      );
      return cachedPlan;
    }
    CreepUtils.consoleLogIfWatched(this.roomw, `planning: no cached plan for ${this.roomw.name}`);
    return [];
  }

  private drawPlan(plan: StructurePlanPosition[]): void {
    this.roomw.visual.clear();
    this.plannerUtils.drawPlan(this.roomw, plan);
    this.roomw.planVisual = this.roomw.visual.export();
  }

  private planColony(): boolean {
    if (!this.roomw.controller)
      throw new Error(`Planning colony in room without controller: ${this.roomw.name}`);
    // add first spawn to plan if it exists to handle first room
    if (this.roomw.spawns[0].pos) {
      this.structurePlan.setPlanPosition(this.roomw.spawns[0].pos, STRUCTURE_SPAWN);
    }

    if (!this.planSourceContainersAndLinks() || !this.planControllerContainerAndLink()) {
      return false;
    }

    const centerPoint = this.findRoomCenterPoint(this.roomw);

    // try full colony first
    let placedColony = false;
    if (
      !this.roomw.memory.colonyType ||
      this.roomw.memory.colonyType === SockPuppetConstants.COLONY_TYPE_FULL
    ) {
      placedColony = this.createFullColonyPlan(centerPoint);
    }

    // try groups colony next
    if (!placedColony && this.roomw.memory.colonyType === SockPuppetConstants.COLONY_TYPE_GROUP) {
      placedColony = this.createGroupColonyPlan(centerPoint);
    }
    return placedColony;
  }

  private createFullColonyPlan(centerPoint: RoomPosition): boolean {
    CreepUtils.consoleLogIfWatched(
      this.roomw,
      `planning: attempting full colony plan ${this.roomw.name}`
    );
    const fullColonyPlan = this.structurePlan.setPattern(StructurePatterns.FULL_COLONY);
    const site = this.plannerUtils.findSiteForPattern(
      fullColonyPlan,
      centerPoint,
      `${this.cacheKey}_fullColonySearch`
    );
    if (site) {
      this.roomw.memory.colonyType = SockPuppetConstants.COLONY_TYPE_FULL;
      fullColonyPlan.mergePatternAtPos(site);
      return true;
    } else {
      this.roomw.memory.colonyType = SockPuppetConstants.COLONY_TYPE_GROUP;
      return false;
    }
  }

  private createGroupColonyPlan(centerPoint: RoomPosition): boolean {
    CreepUtils.consoleLogIfWatched(
      this.roomw,
      `planning: attempting group colony plan ${this.roomw.name}`
    );
    let planOk = this.addPatternToPlan(
      centerPoint,
      StructurePatterns.SPAWN_GROUP,
      `${this.cacheKey}_spawnGroupSearch`
    );
    const maxExtensions = CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][SockPuppetConstants.MAX_RCL];
    const extensionCenterPoint = this.roomw.spawns[0]?.pos ? this.roomw.spawns[0].pos : centerPoint;
    for (let i = 0; planOk && i < maxExtensions; i += 5) {
      planOk = this.addPatternToPlan(
        extensionCenterPoint,
        StructurePatterns.EXTENSION_GROUP,
        `${this.cacheKey}_extensionGroupSearch_${i}`
      );
    }
    if (planOk) {
      planOk = this.addPatternToPlan(
        centerPoint,
        StructurePatterns.LAB_GROUP,
        `${this.cacheKey}_labGroupSearch`
      );
    }
    return planOk;
  }

  private addPatternToPlan(
    centerPoint: RoomPosition,
    pattern: string[],
    cacheKey: string
  ): boolean {
    this.structurePlan.setPattern(pattern);
    const patternPosition = this.plannerUtils.findSiteForPattern(
      this.structurePlan,
      centerPoint,
      cacheKey
    );
    if (patternPosition) {
      this.structurePlan.mergePatternAtPos(patternPosition);
      return true;
    }
    return false;
  }

  /** Finds central point of important features in a room. Uses value from room memory if possible. */
  private findRoomCenterPoint(roomw: RoomWrapper): RoomPosition {
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

  private updateColonyStructures(
    roomw: RoomWrapper,
    planPositions: StructurePlanPosition[]
  ): ScreepsReturnCode {
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
      const wrongStructure = roomw
        .lookForAt(LOOK_STRUCTURES, planPos)
        .find(s => s.structureType !== planPos.structure);
      if (wrongStructure) {
        // a couple of exceptions (don't dismantle own last spawn dummy)
        if (lastSpawn && wrongStructure.structureType === STRUCTURE_SPAWN) {
          return;
        }
        console.log(
          `DISMANTLE ${String(wrongStructure.structureType)} at ${String(wrongStructure.pos)}`
        );
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

  private planRoads(): boolean {
    if (!this.controllerContainerPosition) {
      return false;
    }
    const roadPlanner = new RoadPlanner(this.roomw);

    // plan road from source containers to controller containers
    const roadPositions = roadPlanner.planRoadSourceContainersToControllerContainers(
      this.sourceContainerPositions,
      this.controllerContainerPosition
    );
    if (roadPositions.length === 0) {
      CreepUtils.log(LogLevel.DEBUG, `container road plan incomplete`);
      return false;
    }
    roadPositions.forEach(pos => this.structurePlan.setPlanPosition(pos.pos, pos.structure));

    // plan road from controller to spawn
    const controllerRoadPositions = roadPlanner.planRoadControllerToSpawn();
    if (controllerRoadPositions.length === 0) {
      CreepUtils.log(LogLevel.DEBUG, `controller road plan incomplete`);
      return false;
    }
    controllerRoadPositions.forEach(pos =>
      this.structurePlan.setPlanPosition(pos.pos, pos.structure)
    );

    // plan roads to all extensions
    const extensionRoadPositions = roadPlanner.planRoadSpawnToExtensions();
    if (extensionRoadPositions.length === 0) {
      CreepUtils.log(LogLevel.DEBUG, `extensions road plan incomplete`);
      return false;
    }
    extensionRoadPositions.forEach(pos =>
      this.structurePlan.setPlanPosition(pos.pos, pos.structure)
    );

    return true;
  }

  private planTowers(roomw: RoomWrapper): ScreepsReturnCode {
    // place towers
    if (roomw.getAvailableStructureCount(STRUCTURE_TOWER) > 0) {
      const towerResult = this.plannerUtils.placeTowerAtCenterOfColony(roomw);
      return towerResult;
    }
    return OK;
  }

  private planControllerContainerAndLink(): boolean {
    if (this.roomw.controller) {
      this.controllerContainerPosition = this.findExistingControllerContainer(
        this.roomw.controller
      );
      if (!this.controllerContainerPosition) {
        this.controllerContainerPosition = this.planContainerPosition(this.roomw.controller.pos);
      }
      if (this.controllerContainerPosition) {
        this.structurePlan.setPlanPosition(this.controllerContainerPosition, STRUCTURE_CONTAINER);
        let controllerLinkPosition = this.findExistingControllerLink(
          this.roomw.controller,
          this.controllerContainerPosition
        );
        if (!controllerLinkPosition) {
          controllerLinkPosition = this.planLinkPosition(this.controllerContainerPosition);
        }
        if (controllerLinkPosition) {
          this.structurePlan.setPlanPosition(controllerLinkPosition, STRUCTURE_LINK);
          return true;
        }
      }
    }
    return false;
  }

  private planSourceContainersAndLinks(): boolean {
    for (const source of this.roomw.sources) {
      let sourceContainerPosition = this.findExistingSourceContainer(source);
      if (!sourceContainerPosition) {
        sourceContainerPosition = this.planContainerPosition(source.pos);
      }
      if (sourceContainerPosition) {
        this.sourceContainerPositions.push(sourceContainerPosition);
        this.structurePlan.setPlanPosition(sourceContainerPosition, STRUCTURE_CONTAINER);
        let sourceLinkPosition = this.findExistingSourceLink(source, sourceContainerPosition);
        if (!sourceLinkPosition) {
          sourceLinkPosition = this.planLinkPosition(sourceContainerPosition);
        }
        if (sourceLinkPosition) {
          this.structurePlan.setPlanPosition(sourceLinkPosition, STRUCTURE_LINK);
        } else {
          return false;
        }
      } else {
        return false;
      }
    }
    return true;
  }

  private planContainerPosition(position: RoomPosition): RoomPosition | undefined {
    const AVOID_BOTTLENECK = true;
    const availableContainerPosition = this.plannerUtils.findAvailableAdjacentPosition(
      this.roomw,
      position,
      AVOID_BOTTLENECK
    );
    return availableContainerPosition;
  }

  private planLinkPosition(position: RoomPosition): RoomPosition | undefined {
    const AVOID_BOTTLENECK = true;
    const availableLinkPosition = this.plannerUtils.findAvailableAdjacentPosition(
      this.roomw,
      position,
      AVOID_BOTTLENECK
    );
    return availableLinkPosition;
  }

  private findExistingSourceContainer(source: Source): RoomPosition | undefined {
    const info = this.roomw.memory.sources[source.id].container;
    if (info && this.plannerUtils.validateStructureInfo(info) === OK) {
      return MemoryUtils.unpackRoomPosition(info.pos);
    }
    const findResult = this.plannerUtils.findAdjacentStructure<StructureContainer>(
      source.pos,
      STRUCTURE_CONTAINER
    );
    if (findResult) {
      this.roomw.memory.sources[source.id].container = {
        id: findResult.id,
        pos: MemoryUtils.packRoomPosition(findResult.pos),
        type: STRUCTURE_CONTAINER
      };
      return findResult.pos;
    }
    return undefined;
  }

  private findExistingSourceLink(
    source: Source,
    containerPos: RoomPosition
  ): RoomPosition | undefined {
    const info = this.roomw.memory.sources[source.id].link;
    if (info && this.plannerUtils.validateStructureInfo(info) === OK) {
      return MemoryUtils.unpackRoomPosition(info.pos);
    }
    const findResult = this.plannerUtils.findAdjacentStructure<StructureLink>(
      containerPos,
      STRUCTURE_LINK
    );
    if (findResult) {
      this.roomw.memory.sources[source.id].link = {
        id: findResult.id,
        pos: MemoryUtils.packRoomPosition(findResult.pos),
        type: STRUCTURE_LINK
      };
      return findResult.pos;
    }
    return undefined;
  }

  private findExistingControllerContainer(
    controller: StructureController
  ): RoomPosition | undefined {
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
    const findResult = this.plannerUtils.findAdjacentStructure<StructureLink>(
      containerPos,
      STRUCTURE_LINK
    );
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
