import { TaskType } from "control/tasks/task-management";
import { Task } from "./task";
import { CreepUtils } from "creep-utils";
import { MemoryUtils } from "planning/memory-utils";
import { Hauler } from "roles/hauler";
import { CreepWrapper } from "roles/creep-wrapper";

export class HaulTask extends Task {
  public readonly priority: number;
  public readonly creepName: string;
  public readonly targetId: Id<Creep>;
  public readonly override?: boolean;
  public readonly requirements?: (creep: CreepWrapper) => boolean;

  private creepToHaul: Creep;

  public constructor({
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    type,
    priority,
    pos,
    creepName,
    targetId,
    override,
    requirements
  }: {
    type?: TaskType;
    priority: number;
    pos: RoomPosition;
    creepName: string;
    targetId: Id<Creep>;
    override?: boolean;
    requirements?: (creep: CreepWrapper) => boolean;
  }) {
    super(pos, TaskType.HAUL);
    this.priority = priority;
    this.creepName = creepName;
    this.targetId = targetId;
    this.override = override;
    this.requirements = requirements;
    this.creepToHaul = Game.creeps[this.creepName];
  }

  public validate(): boolean {
    if (!this.creepToHaul) {
      return false;
    }
    return !!this.creepToHaul.memory.haulRequested;
  }

  public cancel(): void {
    if (this.creepToHaul) {
      this.creepToHaul.memory.haulRequested = false;
      this.creepToHaul.memory.haulerName = undefined;
    }
  }

  public work(creep: Hauler): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(creep, `haul ${String(this.creepName)}`);

    // TODO validation here may cause idle tick when haul ends
    CreepUtils.consoleLogIfWatched(creep, `validate haul request `);
    const creepToHaul = Game.creeps[this.creepName];
    if (!creepToHaul || !creepToHaul.memory.haulRequested) {
      CreepUtils.consoleLogIfWatched(creep, `haul request invalid`);
      if (creepToHaul) {
        creepToHaul.memory.haulRequested = false;
        creepToHaul.memory.haulerName = undefined;
      }
      creep.completeTask();
      return ERR_INVALID_TARGET;
    } else {
      creepToHaul.memory.haulerName = creep.name;
    }

    // TODO check size of creep to haul vs store used before waiting to dump
    if (creep.store.getUsedCapacity() > 0) {
      const storage = creep.findRoomStorage();
      if (storage) {
        return creep.storeLoad(storage);
      }
    }

    // start working when near cargo
    if (creep.pos.isNearTo(creepToHaul.pos)) {
      creep.memory.working = true;
    } else if (creep.memory.working && !creep.memory.exitState) {
      // if not near cargo, and not in exit proccess, need to walk back to cargo
      creep.memory.working = false;
    }

    if (!creep.memory.working) {
      // step away from exit if just crossed over and not hauling yet. Prevents room swap loop with cargo creep.
      if (
        creep.memory.lastPos &&
        creep.pos.roomName !== MemoryUtils.unpackRoomPosition(creep.memory.lastPos).roomName
      ) {
        const exitDir = CreepUtils.getClosestExitDirection(creep.pos);
        if (exitDir) {
          const reverseExitDir = CreepUtils.reverseDirection(exitDir);
          const result = creep.move(reverseExitDir);
          CreepUtils.consoleLogIfWatched(creep, `move away from exit`, result);
          return result;
        }
      }
      const result = creep.moveTo(creepToHaul);
      CreepUtils.consoleLogIfWatched(creep, `move to creep`, result);
    }
    return OK;
  }
}
