import { TaskType } from "control/tasks/task-management";
import { RoomWrapper } from "structures/room-wrapper";
import { Task } from "./task";
import { CreepUtils } from "creep-utils";
import { Hauler } from "roles/hauler";
import { CostMatrixUtils } from "utils/cost-matrix-utils";
import { CreepWrapper } from "roles/creep-wrapper";

export class SupplySpawnTask extends Task {
  public readonly priority: number;
  public readonly override?: boolean;
  public readonly salt?: number;
  public readonly requirements?: (creep: CreepWrapper) => boolean;

  public readonly roomw: RoomWrapper;

  public constructor({
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    type,
    priority,
    pos,
    override,
    salt,
    requirements
  }: {
    type?: TaskType;
    priority: number;
    pos: RoomPosition;
    override?: boolean;
    salt?: number;
    requirements?: (creep: CreepWrapper) => boolean;
  }) {
    super(pos, TaskType.SUPPLY_SPAWN);
    this.priority = priority;
    this.override = override;
    this.salt = salt;
    this.requirements = requirements;
    this.roomw = RoomWrapper.getInstance(pos.roomName);
  }

  public validate(): boolean {
    const spawnStorage = this.roomw.spawnStorage.find(s => s.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
    return !!spawnStorage;
  }

  // When supplying spawn, use priority to prefer storage
  public work(creep: Hauler): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(creep, `supply for spawning`);
    let working = !!creep.memory.working;
    if (creep.isEmpty()) {
      working = false;
    }
    if (creep.hasResource(RESOURCE_ENERGY)) {
      working = true;
    }

    if (working) {
      CreepUtils.consoleLogIfWatched(creep, "working");
      const spawnStorage = creep.roomw.spawnStorage.filter(s => s.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
      const targetIndex = spawnStorage.findIndex(s => s.pos.isNearTo(creep.pos));
      if (targetIndex !== -1) {
        const target = spawnStorage[targetIndex];
        const transferResult = creep.transfer(target, RESOURCE_ENERGY);
        CreepUtils.consoleLogIfWatched(creep, `supply ${target.structureType} result`, transferResult);
        // stores do NOT reflect transfer above until next tick
        if (transferResult === OK) {
          creep.completeTask();
        }
        return transferResult;
      } else {
        // get path through remaining extensions
        const path = this.getSpawnSupplyPath(creep, spawnStorage);
        CreepUtils.consoleLogIfWatched(creep, `path: ${String(path)}`);
        const moveResult = creep.moveByPath(path);
        CreepUtils.consoleLogIfWatched(creep, `moving on path`, moveResult);
        return moveResult;
      }
    } else {
      const harvestResult = creep.harvestByPriority();
      CreepUtils.consoleLogIfWatched(creep, `finding energy`, harvestResult);
      return harvestResult;
    }
  }

  private getSpawnSupplyPath(creep: Hauler, spawnStorage: (StructureExtension | StructureSpawn)[]): RoomPosition[] {
    const goals = spawnStorage.map(s => {
      return { pos: s.pos, range: 1 };
    });
    const costMatrixUtils = CostMatrixUtils.getInstance();
    const path = PathFinder.search(creep.pos, goals, {
      plainCost: 2,
      swampCost: 10,
      roomCallback: costMatrixUtils.creepMovementRoomCallback
    });
    if (path.incomplete) {
      CreepUtils.consoleLogIfWatched(creep, `supply path incomplete`);
    }
    return path.path;
  }
}
