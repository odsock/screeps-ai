import { TaskType } from "control/tasks/task-management";
import { Task } from "./task";
import { CreepUtils } from "creep-utils";
import { Hauler } from "roles/hauler";
import { CreepWrapper } from "roles/creep-wrapper";

import { profile } from "../../../screeps-typescript-profiler";

@profile
export class SupplyStructureTask extends Task {
  public readonly priority: number;
  public readonly targetId: Id<StructureWithStorage>;
  public readonly resourceType: ResourceConstant;
  public readonly requirements?: (creep: CreepWrapper) => boolean;
  public readonly salt?: number;
  public readonly override?: boolean;
  public readonly tag?: string;

  public constructor({
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    type,
    priority,
    pos,
    targetId,
    resourceType,
    requirements,
    salt,
    override,
    tag
  }: {
    type?: TaskType;
    priority: number;
    pos: RoomPosition;
    targetId: Id<StructureWithStorage>;
    resourceType: ResourceConstant;
    requirements?: (creep: CreepWrapper) => boolean;
    salt?: number;
    override?: boolean;
    tag?: string;
  }) {
    super(pos, TaskType.SUPPLY_STRUCTURE);
    this.priority = priority;
    this.targetId = targetId;
    this.resourceType = resourceType;
    this.requirements = requirements;
    this.salt = salt;
    this.override = override;
    this.tag = tag;
  }

  public validate(): boolean {
    const target = Game.getObjectById(this.targetId);
    if (!target) {
      return false;
    }
    if (target.store.getFreeCapacity(this.resourceType) === 0) {
      return false;
    }
    return true;
  }

  public work(creep: Hauler): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(creep, `supply structure`);

    const target = Game.getObjectById(this.targetId);
    if (!target) {
      return ERR_INVALID_TARGET;
    }

    let working = true;
    if (creep.isEmpty()) {
      working = true;
    }
    if (creep.hasResource(this.resourceType)) {
      working = false;
    }

    if (working) {
      CreepUtils.consoleLogIfWatched(creep, "seeking energy");
      const result = creep.loadEnergy();
      return result;
    } else {
      if (!creep.pos.isNearTo(target)) {
        const moveResult = creep.moveTo(target, { range: 1, visualizePathStyle: { stroke: "#ffffff" } });
        CreepUtils.consoleLogIfWatched(creep, `moving to ${target.structureType} at ${String(target.pos)}`, moveResult);
        return moveResult;
      } else {
        const transferResult = creep.transfer(target, this.resourceType);
        CreepUtils.consoleLogIfWatched(creep, `transfer result`, transferResult);
        if (transferResult === OK) {
          creep.completeTask();
        }
        return transferResult;
      }
    }
  }
}
