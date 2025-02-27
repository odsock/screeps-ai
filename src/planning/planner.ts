import { SockPuppetConstants } from "config/sockpuppet-constants";
import { StructurePatterns } from "config/structure-patterns";
import { TargetControl } from "control/target-control";
import { CreepUtils, LogLevel } from "creep-utils";
import { RoomWrapper } from "structures/room-wrapper";
import { MemoryUtils } from "./memory-utils";
import { PlannerUtils } from "./planner-utils";
import { StructurePlan, StructurePlanPosition } from "./structure-plan";
import { profile } from "../../screeps-typescript-profiler";
import { CostMatrixUtils } from "utils/cost-matrix-utils";

@profile
export class Planner {
  private readonly targetControl = TargetControl.getInstance();
  private readonly plannerUtils = PlannerUtils.getInstance();
  private readonly costMatrixUtils = CostMatrixUtils.getInstance();

  private readonly structurePlan: StructurePlan;
  private planPositions: StructurePlanPosition[] = [];
  private readonly cacheKey: string;
  private readonly sourceContainerPositions: RoomPosition[] = [];
  private controllerContainerPosition: RoomPosition | undefined;

  public constructor(private readonly roomw: RoomWrapper) {
    this.cacheKey = `${this.roomw.name}_plan`;
    this.structurePlan = new StructurePlan(roomw);
  }

  public run(): void {
    this.getCachedPlan();
    if (this.planPositions.length === 0) {
      if (this.targetControl.remoteHarvestRooms.includes(this.roomw.name)) {
        if (
          !(
            this.planSourceContainersAndLinks() &&
            this.planControllerContainerAndLink() &&
            this.planRoads()
          )
        ) {
          this.removeBadPlan();
        }
      } else if (!(this.roomw.controller?.my && this.planColony() && this.planRoads())) {
        this.removeBadPlan();
      }
    }

    if (this.planPositions.length > 0) {
      this.setCachedPlan();
      this.updateColonyStructures();
      this.drawPlan(this.planPositions);
    }
  }

  private removeBadPlan(): void {
    CreepUtils.consoleLogIfWatched(
      this.roomw,
      `planning: removing bad plan for ${this.roomw.name}`
    );
    this.planPositions = [];
    this.structurePlan.clear();
    MemoryUtils.deleteCache(this.cacheKey);
  }

  private setCachedPlan(): void {
    this.planPositions = this.structurePlan.getPlan();
    MemoryUtils.setCache(this.cacheKey, this.planPositions, -1);
  }

  private getCachedPlan(): void {
    const cachedPlan = MemoryUtils.getCache<StructurePlanPosition[]>(this.cacheKey);
    if (cachedPlan) {
      CreepUtils.consoleLogIfWatched(
        this.roomw,
        `planning: found cached plan for ${this.roomw.name}`
      );
      this.structurePlan.clear();
      this.structurePlan.setPlan(cachedPlan);
      this.planPositions = cachedPlan;
      return;
    }
    CreepUtils.consoleLogIfWatched(this.roomw, `planning: no cached plan for ${this.roomw.name}`);
  }

  private drawPlan(plan: StructurePlanPosition[]): void {
    this.roomw.visual.clear();
    this.plannerUtils.drawPlan(this.roomw, plan);
    this.roomw.planVisual = this.roomw.visual.export();
    this.roomw.visual.clear();
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

    const centerPoint = this.findRoomCenterPoint();

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
  private findRoomCenterPoint(): RoomPosition {
    if (this.roomw.memory.centerPoint) {
      return MemoryUtils.unpackRoomPosition(this.roomw.memory.centerPoint);
    }
    const importantRoomPositions: RoomPosition[] = [];
    if (this.roomw.controller) {
      importantRoomPositions.push(this.roomw.controller.pos);
    }
    importantRoomPositions.push(...this.roomw.sources.map(source => source.pos));
    importantRoomPositions.push(...this.roomw.deposits.map(deposit => deposit.pos));
    const centerPoint = this.plannerUtils.findMidpoint(importantRoomPositions);
    this.roomw.memory.centerPoint = MemoryUtils.packRoomPosition(centerPoint);
    return centerPoint;
  }

  private updateColonyStructures(): ScreepsReturnCode {
    if (Game.flags[`${this.roomw.name}_no_placement`]) {
      return OK;
    }
    // mark misplaced structures for dismantling
    this.createDismantleQueue();
    this.drawDismantleQueue();

    // sort positions by range to focal point of room
    const centerPoint = this.findRoomCenterPoint();
    this.planPositions = this.planPositions.toSorted(
      (a, b) => centerPoint.getRangeTo(a) - centerPoint.getRangeTo(b)
    );

    // try to construct any missing structures
    // only create all roads above RCL 6 to avoid wasting energy
    const skipRoads = (this.roomw.controller?.level ?? 0) < 6;
    let result = this.plannerUtils.placeStructurePlan(this.roomw, this.planPositions, skipRoads);
    CreepUtils.consoleLogIfWatched(this.roomw, `place colony`, result);

    // construct roads in named paths
    if (skipRoads && result === OK) {
      const roomPaths = MemoryUtils.getCache<string[]>(`${this.roomw.name}_paths`) ?? [];
      roomPaths.forEach(pathKey => {
        const path = MemoryUtils.getCache<RoomPosition[]>(pathKey) ?? [];
        const pathPlan = path.map(pos => {
          return { pos, structure: STRUCTURE_ROAD };
        });
        result = this.plannerUtils.placeStructurePlan(this.roomw, pathPlan);
      });
    }

    return result;
  }

  /**
   * Dismantle queue includes structures not in plan, except last spawn, towers, walls, and ramparts unless flagged.
   */
  private createDismantleQueue(): void {
    const lastSpawn = this.roomw.find(FIND_MY_SPAWNS).length === 1;
    const dismantleFlags = _.filter(Game.flags, flag =>
      flag.name.startsWith(`${this.roomw.name}_dismantle`)
    ).map(flag => flag.pos);
    const overlapStructures: Structure[] = [];
    const misplacedStructures: Structure[] = [];
    this.roomw.find(FIND_STRUCTURES).forEach(s => {
      if (
        s.structureType === STRUCTURE_CONTROLLER ||
        (s.structureType === STRUCTURE_SPAWN && lastSpawn) ||
        ([STRUCTURE_WALL, STRUCTURE_RAMPART, STRUCTURE_TOWER].some(t => t === s.structureType) &&
          !dismantleFlags.some(f => f.isEqualTo(s.pos)))
      ) {
        return;
      }
      const plannedStructureType = this.structurePlan.getPlanPosition(s.pos);
      if (!plannedStructureType) {
        misplacedStructures.push(s);
      } else if (plannedStructureType !== s.structureType) {
        overlapStructures.push(s);
      }
    });
    CreepUtils.consoleLogIfWatched(this.roomw, `planning: updating dismantle queue`);
    this.roomw.setDismantleQueue([...overlapStructures, ...misplacedStructures]);
  }

  private drawDismantleQueue(): void {
    CreepUtils.consoleLogIfWatched(this.roomw, `planning: creating dismantle queue visual`);
    this.roomw.visual.clear();
    this.roomw.getDismantleQueue().forEach(structure => {
      this.roomw.visual.circle(structure.pos, {
        fill: "#00000000",
        opacity: 0.8,
        radius: 0.5,
        stroke: "#FF0000"
      });
    });
    this.roomw.dismantleVisual = this.roomw.visual.export();
    this.roomw.visual.clear();
  }

  private planRoads(): boolean {
    // cache current plan for use by costmatrix
    this.setCachedPlan();

    // plan road from source containers to controller containers
    let planOk = this.planRoadSourceContainersToControllerContainers();
    if (!planOk) {
      CreepUtils.consoleLogIfWatched(
        this.roomw,
        `container road plan failed`,
        undefined,
        LogLevel.DEBUG
      );
      return false;
    }

    // plan road from controller to spawn
    planOk = this.planRoadControllerToSpawn();
    if (!planOk) {
      CreepUtils.consoleLogIfWatched(
        this.roomw,
        `controller road plan failed`,
        undefined,
        LogLevel.DEBUG
      );
      return false;
    }

    // plan roads to all extensions
    planOk = this.planRoadSpawnToExtensions();
    if (!planOk) {
      CreepUtils.consoleLogIfWatched(
        this.roomw,
        `extensions road plan failed`,
        undefined,
        LogLevel.DEBUG
      );
      return false;
    }

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

  // Road planning

  private planRoadSourceContainersToControllerContainers(): boolean {
    CreepUtils.log(LogLevel.DEBUG, "road planning: sources to controller");
    if (!this.controllerContainerPosition) {
      CreepUtils.log(
        LogLevel.ERROR,
        `${this.roomw.name}: road planning: sources to controller missing controller container position`
      );
      return false;
    }
    // get a path and place road for each pair of containers
    for (const sourceContainerPosition of this.sourceContainerPositions) {
      const path: PathFinderPath = this.planRoad(
        sourceContainerPosition,
        this.controllerContainerPosition,
        1
      );
      if (!path.incomplete && path.path.length !== 0) {
        path.path.forEach(pos => this.structurePlan.setPlanPosition(pos, STRUCTURE_ROAD));
        this.setCachedPlan();
      } else {
        CreepUtils.log(
          LogLevel.ERROR,
          `${this.roomw.name}: road planning bad path: ${JSON.stringify(path)}`
        );
        return false;
      }
    }
    return true;
  }

  private planRoadControllerToSpawn(): boolean {
    if (!this.roomw.controller) {
      return false;
    }
    const spawn = this.structurePlan
      .getPlan()
      .find(planPos => planPos.structure === STRUCTURE_SPAWN);
    if (!spawn) {
      return false;
    }
    const path = this.planRoad(spawn.pos, this.roomw.controller.pos, 2);
    if (!path.incomplete && path.path.length !== 0) {
      path.path.forEach(pos => this.structurePlan.setPlanPosition(pos, STRUCTURE_ROAD));
      this.setCachedPlan();
      return true;
    }
    return false;
  }

  private planRoadSpawnToExtensions(): boolean {
    const extensions = this.structurePlan
      .getPlan()
      .filter(planPos => planPos.structure === STRUCTURE_EXTENSION)
      .map(planPos => planPos.pos);
    const spawns = this.structurePlan
      .getPlan()
      .filter(planPos => planPos.structure === STRUCTURE_SPAWN)
      .map(planPos => planPos.pos);
    for (const spawn of spawns) {
      for (const extension of extensions) {
        const path = this.planRoad(spawn, extension, 1);
        if (path.incomplete) {
          return false;
        }
        if (path.path.length !== 0) {
          path.path.forEach(pos => this.structurePlan.setPlanPosition(pos, STRUCTURE_ROAD));
          this.setCachedPlan();
        }
      }
    }
    return true;
  }

  private cachePath(path: PathFinderPath): void {
    const start = path.path[0];
    const end = path.path[path.path.length - 1];
    const packedStart = MemoryUtils.packRoomPosition(start);
    const packedEnd = MemoryUtils.packRoomPosition(end);
    const cacheKeyTo = `${this.roomw.name}_path_${packedStart}_to_${packedEnd}`;
    const cacheKeyFrom = `${this.roomw.name}_path_${packedEnd}_to_${packedStart}`;
    MemoryUtils.setCache(cacheKeyTo, path.path, -1);
    MemoryUtils.setCache(cacheKeyFrom, path.path.toReversed(), -1);
    const roomPaths = MemoryUtils.getCache<string[]>(`${this.roomw.name}_paths`) ?? [];
    roomPaths.push(cacheKeyTo);
    MemoryUtils.setCache(`${this.roomw.name}_paths`, [...new Set(roomPaths)], -1); // cache uniqueified list of path keys
  }

  private planRoad(origin: RoomPosition, goal: RoomPosition, range = 0): PathFinderPath {
    const path = PathFinder.search(
      origin,
      { pos: goal, range },
      { swampCost: 2, plainCost: 2, roomCallback: this.costMatrixUtils.roadPlanningRoomCallback }
    );
    if (path.incomplete) {
      CreepUtils.log(
        LogLevel.DEBUG,
        `road planing: incomplete: ${String(origin)} -> ${String(goal)}`
      );
    }
    return path;
  }

  private planWall(side: TOP | BOTTOM | LEFT | RIGHT): boolean {
    this.findRoomEntrance(side);

    return false;
  }

  private findRoomEntrance(side: TOP | BOTTOM | LEFT | RIGHT): number[][] {
    const terrain = this.roomw.getTerrain();

    const entrances = [];
    let start = 0;
    let end = 0;
    for (let i = 0; i < SockPuppetConstants.ROOM_SIZE; i++) {
      let terrainType;
      if (side === TOP) {
        terrainType = terrain.get(i, 0);
      } else if (side === BOTTOM) {
        terrainType = terrain.get(i, SockPuppetConstants.ROOM_SIZE - 1);
      } else if (side === LEFT) {
        terrainType = terrain.get(0, i);
      } else {
        terrainType = terrain.get(SockPuppetConstants.ROOM_SIZE - 1, i);
      }
      if (terrainType === 0) {
        if (start === 0) {
          start = i;
        } else {
          end = i;
        }
      } else if (start !== 0) {
        entrances.push([start, end]);
        start = 0;
        end = 0;
      }
    }
    return entrances;
  }
}
