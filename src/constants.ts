class Constants {
  public static readonly MAX_WORKERS: number = 5;
  public static readonly WORK_PER_WORKER_PART = 1000;

  public static readonly BODY_PROFILE_WORKER: CreepBodyProfile = {
    profile: [WORK, MOVE, CARRY],
    seed: [],
    maxBodyParts: MAX_CREEP_SIZE
  };

  public static readonly BODY_PROFILE_HARVESTER: CreepBodyProfile = {
    profile: [WORK],
    seed: [MOVE, CARRY],
    maxBodyParts: 10
  };

  public static readonly BODY_PROFILE_UPGRADER: CreepBodyProfile = {
    profile: [WORK],
    seed: [MOVE, CARRY],
    maxBodyParts: 6
  };

  public static readonly BODY_PROFILE_HAULER: CreepBodyProfile = {
    profile: [MOVE, CARRY, CARRY],
    seed: [],
    maxBodyParts: 30
  };

  public static readonly BODY_PROFILE_BUILDER: CreepBodyProfile = {
    profile: [WORK, MOVE, CARRY],
    seed: [],
    maxBodyParts: MAX_CREEP_SIZE
  };

  public static readonly STRUCTURE_PLAN_EXTENSION_GROUP: StructurePatternPosition[] = [
    { xOffset: 2, yOffset: 0, structure: STRUCTURE_ROAD },
    { xOffset: 1, yOffset: 1, structure: STRUCTURE_ROAD },
    { xOffset: 2, yOffset: 1, structure: STRUCTURE_EXTENSION },
    { xOffset: 3, yOffset: 1, structure: STRUCTURE_ROAD },
    { xOffset: 0, yOffset: 2, structure: STRUCTURE_ROAD },
    { xOffset: 1, yOffset: 2, structure: STRUCTURE_EXTENSION },
    { xOffset: 2, yOffset: 2, structure: STRUCTURE_EXTENSION },
    { xOffset: 3, yOffset: 2, structure: STRUCTURE_EXTENSION },
    { xOffset: 4, yOffset: 2, structure: STRUCTURE_ROAD },
    { xOffset: 1, yOffset: 3, structure: STRUCTURE_ROAD },
    { xOffset: 2, yOffset: 3, structure: STRUCTURE_EXTENSION },
    { xOffset: 3, yOffset: 3, structure: STRUCTURE_ROAD },
    { xOffset: 2, yOffset: 4, structure: STRUCTURE_ROAD }
  ];

  public static readonly ROOM_SIZE = 50;
  public static readonly MAX_DISTANCE = 99999;
  public static readonly TOWER_RESUPPLY_THRESHOLD = 0.75;

  public static readonly CONSTRUCTION_PRIORITY: StructureConstant[] = [
    STRUCTURE_TOWER,
    STRUCTURE_EXTENSION,
    STRUCTURE_CONTAINER
  ];
}
export default Constants;
