import { TaskType } from "control/tasks/task-management";
import { CreepUtils } from "creep-utils";
import { Hauler } from "roles/hauler";
import { RoomWrapper } from "structures/room-wrapper";
import { Task } from "./task";

export class SupplyCreepTask extends Task {
  public readonly priority: number;
  public readonly override?: boolean;
  public readonly requirements?: (creep: Creep) => boolean;

  public readonly roomw: RoomWrapper;
  public readonly resourcetype: ResourceConstant = RESOURCE_ENERGY;
  public readonly targetId: Id<Creep>;
  public readonly creepName: string;
  public readonly creepToSupply: Creep;

  public constructor({
    type,
    priority,
    pos,
    creepName,
    targetId,
    resourceType,
    override,
    requirements
  }: {
    type?: TaskType;
    priority: number;
    pos: RoomPosition;
    creepName: string;
    targetId: Id<Creep>;
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
    this.targetId = targetId;
    this.creepName = creepName;
    this.creepToSupply = Game.creeps[this.creepName];
  }

  public validate(): boolean {
    if (!this.creepToSupply) {
      return false;
    }
    return this.creepToSupply.store.getFreeCapacity() > 0;
  }

  public work(creep: Hauler): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(creep, `supply creep`);
    let working = !!creep.memory.working;
    if (creep.isEmpty()) {
      working = true;
    }
    if (creep.hasResource(this.resourcetype)) {
      working = false;
    }

    if (working) {
      CreepUtils.consoleLogIfWatched(creep, "working");
      const loadResult = creep.loadEnergy();
      if (loadResult === OK) {
        creep.memory.working = false;
      }
      return loadResult;
    } else {
      const transferResult = creep.moveToAndTransfer(this.creepToSupply, RESOURCE_ENERGY);
      CreepUtils.consoleLogIfWatched(creep, `supply ${this.creepName} result`, transferResult);
      // stores do NOT reflect transfer above until next tick
      if (transferResult === OK) {
        this.complete();
        creep.completeTask();
      }
      return OK;
    }
  }
}
