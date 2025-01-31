// prettier-ignore
import { profile } from "../../screeps-typescript-profiler";

@profile
export class StructurePatterns {
  public static readonly FULL_COLONY: string[] = [
    "        r",
    "       rer",
    "      reeer",
    "     rererer",
    "    reeereeer",
    "   rererrrerer",
    "  reeersssreeer",
    " rererrSrlrrerer",
    "reeerLtTrFtLreeer",
    " rererLL LLrerer",
    "  reeerLLLreeer",
    "   rererLrerer",
    "    reeereeer",
    "     rererer",
    "      reeer",
    "       rer",
    "        r"
  ];

  public static readonly EXTENSION_GROUP: string[] = ["  r", " rer", "reeer", " rer", "  r"];

  public static readonly CONTROL_GROUP: string[] = [
    "    r",
    "   rrr",
    "  rsssr",
    " rrSrlrr",
    "rLrTPFrLr",
    " rLLrLLr",
    "  rLLLr",
    "   rLr",
    "    r"
  ];

  public static readonly SPAWN_GROUP: string[] = ["  rrr", " rsssr", "rtPrltr", " rTSFr", "  rrr"];

  public static readonly LAB_GROUP: string[] = ["  r", " rLr", "rLLLr", " rLr", "  r"];

  public static readonly CHARACTERS: { [x: string]: BuildableStructureConstant | undefined } = {
    r: STRUCTURE_ROAD,
    e: STRUCTURE_EXTENSION,
    c: STRUCTURE_CONTAINER,
    s: STRUCTURE_SPAWN,
    S: STRUCTURE_STORAGE,
    L: STRUCTURE_LAB,
    l: STRUCTURE_LINK,
    T: STRUCTURE_TERMINAL,
    t: STRUCTURE_TOWER,
    O: STRUCTURE_OBSERVER,
    P: STRUCTURE_POWER_SPAWN,
    F: STRUCTURE_FACTORY,
    N: STRUCTURE_NUKER,
    " ": undefined
  };

  public static readonly COLORS: { [x: string]: string } = {
    road: "#808080", // Gray, representing basic infrastructure (roads)
    extension: "#228B22", // Forest green, symbolizing expansion and growth
    container: "#FFD700", // Gold, representing storage and valuable containment
    spawn: "#FF4500", // Orange-red, representing energy and creation
    storage: "#4682B4", // Steel blue, symbolizing security and resource storage
    lab: "#8A2BE2", // Blue violet, representing science, research, and innovation
    link: "#D2691E", // Chocolate, symbolizing connections and communication
    terminal: "#1E90FF", // Dodger blue, representing central processing and connectivity
    tower: "#DC143C", // Crimson red, signaling defense and power
    observer: "#32CD32", // Lime green, reflecting surveillance and observation
    power_spawn: "#FF1493", // Deep pink, symbolizing power generation
    factory: "#A9A9A9", // Dark gray, indicating industrial production
    nuker: "#8B0000" // Dark red, evoking the power and danger of a nuclear weapon
  };
}

// CONTROLLER_STRUCTURES: {
//   "spawn":     {0: 0, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 2, 8: 3},
//   "extension": {0: 0, 1: 0, 2: 5, 3: 10, 4: 20, 5: 30, 6: 40, 7: 50, 8: 60},
//   "link":            {1: 0, 2: 0, 3: 0, 4: 0, 5: 2, 6: 3, 7: 4, 8: 6},
//   "road":      {0: 2500, 1: 2500, 2: 2500, 3: 2500, 4: 2500, 5: 2500, 6: 2500, 7: 2500, 8: 2500},
//   "constructedWall": {1: 0, 2: 2500, 3: 2500, 4: 2500, 5: 2500, 6: 2500, 7: 2500, 8: 2500},
//   "rampart":         {1: 0, 2: 2500, 3: 2500, 4: 2500, 5: 2500, 6: 2500, 7: 2500, 8: 2500},
//   "storage":         {1: 0, 2: 0, 3: 0, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1},
//   "tower":           {1: 0, 2: 0, 3: 1, 4: 1, 5: 2, 6: 2, 7: 3, 8: 6},
//   "observer":        {1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 1},
//   "powerSpawn":      {1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 1},
//   "extractor":       {1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 1, 7: 1, 8: 1},
//   "terminal":        {1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 1, 7: 1, 8: 1},
//   "lab":             {1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 3, 7: 6, 8: 10},
//   "container": {0: 5, 1: 5, 2: 5, 3: 5, 4: 5, 5: 5, 6: 5, 7: 5, 8: 5},
//   "nuker":           {1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 1},
//   "factory":         {1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 1, 8: 1}
// },
