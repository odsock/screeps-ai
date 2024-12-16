import { TaskType } from "control/tasks/task-management";
import { RoomWrapper } from "structures/room-wrapper";
import { Task } from "./task";

export class SupplySpawnTask extends Task {
  public readonly priority: number;
  public readonly override?: boolean;
  public readonly salt?: number;
  public readonly requirements?: (creep: Creep) => boolean;

  public readonly roomw: RoomWrapper;

  public constructor({
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
    requirements?: (creep: Creep) => boolean;
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
}
