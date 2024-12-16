import { CreepRole } from "config/creep-types";
import { TaskType } from "control/tasks/task-management";
import { RoomWrapper } from "structures/room-wrapper";
import { Task } from "./task";
import { Hauler } from "roles/hauler";
import { CreepUtils } from "creep-utils";
import { CostMatrixUtils } from "utils/cost-matrix-utils";

export class SupplyCreepTask extends Task {
  public readonly priority: number;
  public readonly override?: boolean;
  public readonly requirements?: (creep: Creep) => boolean;

  public readonly roomw: RoomWrapper;
  public readonly resourcetype: ResourceConstant = RESOURCE_ENERGY;

  public constructor({
    type,
    priority,
    pos,
    resourceType,
    override,
    requirements
  }: {
    type?: TaskType;
    priority: number;
    pos: RoomPosition;
    resourceType?: ResourceConstant;
    override?: boolean;
    requirements?: (creep: Creep) => boolean;
  }) {
    super(pos, TaskType.SUPPLY_CREEP);
    this.priority = priority;
    this.override = override;
    this.resourcetype = resourceType ?? this.resourcetype;
    this.requirements = requirements;
    this.roomw = RoomWrapper.getInstance(pos.roomName);
  }

  public validate(): boolean {
    // TODO store creep to supply as a targetId
    const creepToSupply = this.roomw.creeps.find(
      c => [CreepRole.BUILDER, CreepRole.UPGRADER, CreepRole.WORKER].includes(c.memory.role) && c.store.energy === 0
    );
    return !!creepToSupply;
  }

  // TODO add target info to supply creep task
  public work(creep: Hauler): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(creep, `supply creeps`);
    let working = !!creep.memory.working;
    if (creep.isEmpty()) {
      working = true;
    }
    if (creep.hasResource(this.resourcetype)) {
      working = false;
    }

    const creeps = creep.roomw.creeps.filter(
      c => [CreepRole.BUILDER, CreepRole.UPGRADER, CreepRole.WORKER].includes(c.memory.role) && c.store.energy === 0
    );
    if (creeps.length === 0) {
      creep.completeTask();
      return ERR_NOT_FOUND;
    }

    if (working) {
      CreepUtils.consoleLogIfWatched(creep, "working");
      const loadResult = creep.loadEnergy();
      if (loadResult === OK) {
        creep.memory.working = false;
      }
      return loadResult;
    } else {
      const target = creeps.find(c => c.pos.isNearTo(creep.pos));
      if (target) {
        const transferResult = creep.transfer(target, RESOURCE_ENERGY);
        CreepUtils.consoleLogIfWatched(creep, `supply ${target.name} result`, transferResult);
        // stores do NOT reflect transfer above until next tick
        const targetFreeCap = target.store.getFreeCapacity(RESOURCE_ENERGY);
        const creepStoredEnergy = creep.store.getUsedCapacity(RESOURCE_ENERGY);
        if (transferResult === OK && targetFreeCap >= creepStoredEnergy) {
          CreepUtils.consoleLogIfWatched(creep, `empty`);
          const loadResult = creep.loadEnergy();
          return loadResult;
        }
      }
      // get path through all creeps
      const goals = creeps.map(c => {
        return { pos: c.pos, range: 1 };
      });
      const costMatrixUtils = CostMatrixUtils.getInstance();
      const path = PathFinder.search(creep.pos, goals, {
        plainCost: 2,
        swampCost: 10,
        roomCallback: costMatrixUtils.creepMovementRoomCallback
      });
      CreepUtils.consoleLogIfWatched(creep, `path: ${String(path.path)}`);
      const moveResult = creep.moveByPath(path.path);
      CreepUtils.consoleLogIfWatched(creep, `moving on path`, moveResult);
      return moveResult;
    }
  }
}
