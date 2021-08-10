export class Constants {
  public static readonly MAX_WORKERS: number = 8;
  public static readonly MAX_FIXER_CREEPS: number = 1;

  public static readonly WORK_PER_WORKER_PART = 1000;

  public static readonly MAX_HITS_WALL = 10000000;

  public static readonly BODY_PROFILE_FIXER: CreepBodyProfile = {
    profile: [WORK, CARRY, MOVE, MOVE],
    seed: [],
    maxBodyParts: MAX_CREEP_SIZE
  };

  public static readonly BODY_PROFILE_WORKER: CreepBodyProfile = {
    profile: [WORK, MOVE, CARRY],
    seed: [],
    maxBodyParts: MAX_CREEP_SIZE
  };

  public static readonly BODY_PROFILE_MINDER: CreepBodyProfile = {
    profile: [WORK],
    seed: [MOVE, CARRY],
    maxBodyParts: 10
  };

  public static readonly BODY_PROFILE_HAULER: CreepBodyProfile = {
    profile: [MOVE, CARRY, CARRY],
    seed: [],
    maxBodyParts: 27
  };

  public static readonly BODY_PROFILE_BUILDER: CreepBodyProfile = {
    profile: [WORK, MOVE, CARRY],
    seed: [],
    maxBodyParts: MAX_CREEP_SIZE
  };

  public static readonly BODY_PROFILE_CLAIMER: CreepBodyProfile = {
    profile: [MOVE, WORK, CARRY],
    seed: [MOVE, CLAIM],
    maxBodyParts: MAX_CREEP_SIZE
  };

  public static readonly ROOM_SIZE = 50;
  public static readonly MAX_DISTANCE = 99999;
  public static readonly TOWER_RESUPPLY_THRESHOLD = 0.75;

  public static readonly CONSTRUCTION_PRIORITY: StructureConstant[] = [
    STRUCTURE_TOWER,
    STRUCTURE_EXTENSION,
    STRUCTURE_CONTAINER
  ];

  public static readonly BANNER_HEADER: string = `################################################################`;
  public static readonly BANNER_BODY: string = `
   ___              _                                       _
  / __|  ___   __  | |__  _ __   _  _   _ __   _ __   ___  | |_
  \\__ \\ / _ \\ / _| | / / | '_ \\ | || | | '_ \\ | '_ \\ / -_) |  _|
  |___/ \\___/ \\__| |_\\_\\ | .__/  \\_,_| | .__/ | .__/ \\___|  \\__|
                         |_|           |_|    |_|
`;
  public static readonly BANNER_FOOTER: string = `################################################################`;

  public static readonly ERROR_CODE_LOOKUP = new Map<number, string>([
    [0, "OK"],
    [-1, "ERR_NOT_OWNER"],
    [-2, "ERR_NO_PATH"],
    [-3, "ERR_NAME_EXISTS"],
    [-4, "ERR_BUSY"],
    [-5, "ERR_NOT_FOUND"],
    [-6, "ERR_NOT_ENOUGH_RESOURCES"],
    [-7, "ERR_INVALID_TARGET"],
    [-8, "ERR_FULL"],
    [-9, "ERR_NOT_IN_RANGE"],
    [-10, "ERR_INVALID_ARGS"],
    [-11, "ERR_TIRED"],
    [-12, "ERR_NO_BODYPART"],
    [-14, "ERR_RCL_NOT_ENOUGH"],
    [-15, "ERR_GCL_NOT_ENOUGH"]
  ]);
}
