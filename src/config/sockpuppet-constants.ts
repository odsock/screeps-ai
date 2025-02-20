import { profile } from "../../screeps-typescript-profiler";

@profile
export class SockPuppetConstants {
  public static readonly MAX_UPGRADERS = 5;
  public static readonly MAX_FIXER_CREEPS = 1;
  public static readonly MAX_BUILDER_CREEPS = 5;

  public static readonly WORK_PER_WORKER_PART = 1000;

  public static readonly WALL_MAINT_RCL = 8;
  public static readonly MAX_HITS_WALL = 7000000;
  public static readonly WALL_MAINT_TRIGGER = 0.8;

  public static readonly TOWER_MAX_REPAIR_RANGE = TOWER_OPTIMAL_RANGE;
  public static readonly TOWER_MAX_ATTACK_RANGE = TOWER_OPTIMAL_RANGE * 3;
  public static readonly TOWER_MAX_HEAL_RANGE = TOWER_OPTIMAL_RANGE * 3;

  public static readonly PLANNING_INTERVAL = 10;
  //   BODYPART_COST: {
  //     "move": 50,
  //     "work": 100,
  //     "attack": 80,
  //     "carry": 50,
  //     "heal": 250,
  //     "ranged_attack": 150,
  //     "tough": 10,
  //     "claim": 600
  // },

  public static readonly ROOM_SIZE = 50;
  public static readonly MAX_DISTANCE = 99999;

  public static readonly CONSTRUCTION_PRIORITY: StructureConstant[] = [
    STRUCTURE_SPAWN,
    STRUCTURE_TOWER,
    STRUCTURE_EXTENSION,
    STRUCTURE_CONTAINER,
    STRUCTURE_LINK,
    STRUCTURE_ROAD,
    STRUCTURE_STORAGE,
    STRUCTURE_RAMPART,
    STRUCTURE_OBSERVER,
    STRUCTURE_POWER_SPAWN,
    STRUCTURE_EXTRACTOR,
    STRUCTURE_LAB,
    STRUCTURE_TERMINAL,
    STRUCTURE_NUKER,
    STRUCTURE_FACTORY,
    STRUCTURE_WALL
  ];

  public static readonly STRUCTURE_ATTACK_PRIORITY: StructureConstant[] = [
    STRUCTURE_TOWER,
    STRUCTURE_SPAWN,
    STRUCTURE_TERMINAL,
    STRUCTURE_LINK,
    STRUCTURE_EXTENSION
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

  public static FLAG_COLOR_ATTACK = COLOR_RED;
  public static FLAG_COLOR_REMOTE = COLOR_YELLOW;
  public static FLAG_COLOR_TARGET = COLOR_GREEN;
  public static FLAG_COLOR_SCOUT = COLOR_WHITE;
  public static FLAG_COLOR_FORBIDDEN = COLOR_GREY;

  public static readonly COLONY_TYPE_FULL = "full";
  public static readonly COLONY_TYPE_GROUP = "group";
  public static readonly START_TICK = "START_TICK";
  public static readonly UPGRADE_EFFICIENCY_RATIO = 0.8;
  public static readonly CPU_TOTAL = "CPU_TOTAL";

  public static readonly TASK_CLEANUP_PRIORITY = 100;
  public static readonly TASK_CLEANUP_THRESHOLD = 0;
  public static readonly TASK_SUPPLY_CREEP_PRIORITY = 90;
  public static readonly TASK_SUPPLY_CREEP_THRESHOLD = 0;
  public static readonly TASK_UNLOAD_SOURCE_CONTAINER_PRIORITY = 145;
  public static readonly TASK_UNLOAD_SOURCE_CONTAINER_THRESHOLD = 0.75;
  public static readonly TASK_CONTAINER_CLEANUP_PRIORITY = 50;
  public static readonly TASK_SUPPLY_SPAWN_PRIORITY = 250; // override: true
  public static readonly TASK_SUPPLY_SPAWN_THRESHOLD = 1.0;
  public static readonly TASK_SUPPLY_TOWER_PRIORITY = 250;
  public static readonly TASK_SUPPLY_TOWER_THRESHOLD = 0.9;
  public static readonly TASK_SUPPLY_CONTROLLER_PRIORITY = 80;
  public static readonly TASK_SUPPLY_CONTROLLER_DOWNGRADE_PRIORITY = 150;
  public static readonly TASK_SUPPLY_CONTROLLER_THRESHOLD = 0.25;
  public static readonly TASK_HAUL_UPGRADER_PRIORITY = 150;
  public static readonly TASK_HAUL_HARVESTER_PRIORITY = 150; // override: true
  public static readonly TASK_HAUL_HARVESTER_NO_ENERGY_PRIORITY = 300;
  public static readonly TASK_HAUL_STORE_MINDER_PRIORITY = 140;

  public static readonly MAX_RCL = 8;
}

declare global {
  const BUILDABLE_STRUCTURES: [
    STRUCTURE_EXTENSION,
    STRUCTURE_RAMPART,
    STRUCTURE_ROAD,
    STRUCTURE_SPAWN,
    STRUCTURE_LINK,
    STRUCTURE_WALL,
    STRUCTURE_STORAGE,
    STRUCTURE_TOWER,
    STRUCTURE_OBSERVER,
    STRUCTURE_POWER_SPAWN,
    STRUCTURE_EXTRACTOR,
    STRUCTURE_LAB,
    STRUCTURE_TERMINAL,
    STRUCTURE_CONTAINER,
    STRUCTURE_NUKER,
    STRUCTURE_FACTORY
  ];

  interface StructureWithStorage extends Structure {
    store: StoreDefinition;
  }
}
