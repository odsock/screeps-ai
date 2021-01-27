class Constants {
  static readonly MAX_CREEPS: number = 4;
  static readonly BODY_WORKER: BodyPartConstant[] = [WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY];
  static readonly BODY_HARVESTER: BodyPartConstant[] = [MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, WORK, WORK];
}
export default Constants;