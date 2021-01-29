class Constants {
  static readonly MAX_CREEPS: number = 8;
  static readonly BODY_HARVESTER: BodyPartConstant[] = [
    MOVE, MOVE,
    WORK, WORK, WORK, WORK, WORK, WORK, WORK];
  static readonly BODY_PROFILE_WORKER: BodyPartConstant[] = [WORK, MOVE, CARRY];
}
export default Constants;