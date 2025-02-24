import { profile } from "../../screeps-typescript-profiler";

@profile
export class TowerWrapper {
  public constructor(private readonly tower: StructureTower) {}

  public get pos(): RoomPosition {
    return this.tower.pos;
  }

  public get id(): Id<StructureWithStorage> {
    return this.tower.id;
  }

  public get store(): Store<"energy", false> {
    return this.tower.store;
  }

  public repair(target: Structure<StructureConstant>): ScreepsReturnCode {
    return this.tower.repair(target);
  }

  public heal(target: AnyCreep): ScreepsReturnCode {
    return this.tower.heal(target);
  }

  public attack(target: Structure<StructureConstant> | AnyCreep): ScreepsReturnCode {
    return this.tower.attack(target);
  }
}
