import { StructurePatterns } from "config/structure-patterns";
import { TargetControl } from "control/target-control";
import { CreepUtils } from "creep-utils";
import { RoomWrapper } from "structures/room-wrapper";
import { profile } from "../../screeps-typescript-profiler";
import { ContainerPlan } from "./container-plan";
import { ExtensionPlan } from "./extension-plan";
import { MemoryUtils } from "./memory-utils";
import { PlannerUtils } from "./planner-utils";
import { RoadPlan } from "./road-plan";
import { StructurePlanPosition } from "./structure-plan";

@profile
export class Planner {
  public run(): void {
    // plan each room we can see
    _.forEach(Game.rooms, room => {
      const roomw = RoomWrapper.getInstance(room.name);
      console.log(`${roomw.name}: running planning`);

      if (TargetControl.remoteHarvestRooms.includes(room.name)) {
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

  private createColonyPlan(roomw: RoomWrapper): void {
    const cacheKey = `${roomw.name}_plan`;
    if (!MemoryUtils.hasCache(cacheKey)) {
      CreepUtils.consoleLogIfWatched(roomw, `no colony plan found, generating plan`);
      const controllerPos = roomw.controller?.pos;
      if (controllerPos) {
        const sourcePositions = roomw.sources.map(source => source.pos);
        const depositPositions = roomw.deposits.map(deposit => deposit.pos);

        // find the best colony placement
        const centerPoint = PlannerUtils.findMidpoint([controllerPos, ...sourcePositions, ...depositPositions]);
        roomw.memory.centerPoint = MemoryUtils.packRoomPosition(centerPoint);
        const plan = PlannerUtils.findSiteForPattern(StructurePatterns.FULL_COLONY, roomw, centerPoint, true);

        if (plan) {
          // draw plan visual
          roomw.visual.clear();
          roomw.visual.circle(centerPoint.x, centerPoint.y, { fill: "#FF0000" });
          plan.drawPattern();
          roomw.planVisual = roomw.visual.export();

          // cache plan forever
          MemoryUtils.setCache(cacheKey, plan.getPlan(), -1);
        }
      }
    }
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
      plan: planPositions,
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

  private planRoads(roomw: RoomWrapper): ScreepsReturnCode {
    // place road from source containers to controller containers
    const roadPlan = new RoadPlan(roomw);
    const containerRoadResult = roadPlan.placeRoadSourceContainersToControllerContainers();
    if (containerRoadResult !== OK) {
      return containerRoadResult;
    }

    // place road from controller to spawn
    const controllerRoadResult = roadPlan.placeRoadControllerToSpawn();
    return controllerRoadResult;
  }

  private planAvailableExtensionsByGroup(roomw: RoomWrapper): ScreepsReturnCode {
    // place available extensions
    const extensionPlan = new ExtensionPlan(roomw);
    const extensionResult = extensionPlan.planExtensionGroup();
    if (extensionResult !== OK) {
      return extensionResult;
    }

    // place roads to all extensions
    const roadPlan = new RoadPlan(roomw);
    const extensionRoadResult = roadPlan.placeRoadSpawnToExtensions();
    return extensionRoadResult;
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
