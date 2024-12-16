import { CreepRole } from "config/creep-types";
import { TaskType } from "control/tasks/task-management";
import { RoomWrapper } from "structures/room-wrapper";
import { Task } from "./task";

export class SupplyCreepTask extends Task {
  public readonly priority: number;
  public readonly override?: boolean;
  public readonly requirements?: (creep: Creep) => boolean;

  public readonly roomw: RoomWrapper;

  public constructor({
    type,
    priority,
    pos,
    override,
    requirements
  }: {
    type?: TaskType;
    priority: number;
    pos: RoomPosition;
    override?: boolean;
    requirements?: (creep: Creep) => boolean;
  }) {
    super(pos, TaskType.SUPPLY_CREEP);
    this.priority = priority;
    this.override = override;
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
}
