import { Worker } from "./worker";
import { Hauler } from "./hauler";
import { Builder } from "./builder";
import { Claimer } from "./claimer";
import { Fixer } from "./fixer";
import { Importer } from "./importer";
import { Guard } from "./guard";
import { Upgrader } from "./upgrader";
import { CreepRole } from "config/creep-types";
import { Harvester } from "./harvester";
import { CreepWrapper } from "./creep-wrapper";
import { Minder } from "./minder";
import { profile } from "../../screeps-typescript-profiler";
import { Raider } from "./raider";

@profile
export class CreepFactory {
  /** Instantiate role class for creep based on memory value. */
  public static getCreep(creep: Creep): CreepWrapper {
    switch (creep.memory.role) {
      case CreepRole.WORKER:
        return new Worker(creep);
      case CreepRole.HARVESTER:
        return new Harvester(creep);
      case CreepRole.UPGRADER:
        return new Upgrader(creep);
      case CreepRole.HAULER:
        return new Hauler(creep);
      case CreepRole.BUILDER:
        return new Builder(creep);
      case CreepRole.CLAIMER:
        return new Claimer(creep);
      case CreepRole.FIXER:
        return new Fixer(creep);
      case CreepRole.IMPORTER:
        return new Importer(creep);
      case CreepRole.GUARD:
        return new Guard(creep);
      case CreepRole.RAIDER:
        return new Raider(creep);

      default:
        assertNever(creep.memory.role);
    }

    function assertNever(x: never): never {
      throw new Error("Missing role handler: " + JSON.stringify(x));
    }
  }

  public static getHaulableCreep(creep: Creep): Minder {
    switch (creep.memory.role) {
      case CreepRole.HARVESTER:
        return new Harvester(creep);
      case CreepRole.UPGRADER:
        return new Upgrader(creep);

      default:
        throw new Error(`Unknown creep role: ${creep.memory.role}`);
    }
  }
}
