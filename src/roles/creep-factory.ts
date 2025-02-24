import { CreepRole } from "config/creep-types";

import { Builder } from "./builder";
import { Claimer } from "./claimer";
import { CreepWrapper } from "./creep-wrapper";
import { Fixer } from "./fixer";
import { Guard } from "./guard";
import { Harvester } from "./harvester";
import { Hauler } from "./hauler";
import { Importer } from "./importer";
import { Minder } from "./minder";
import { Raider } from "./raider";
import { Scout } from "./scout";
import { Upgrader } from "./upgrader";
import { Worker } from "./worker";
import { StoreMinder } from "./store-minder";

import { profile } from "../../screeps-typescript-profiler";
import { MemoryUtils } from "planning/memory-utils";

@profile
export class CreepFactory {
  /**
   * Manages singleton CreepWrappers for all creeps this tick.
   * @param creep A creep to wrap.
   * @returns Instance of CreepWrapper for the creep, from cache if possible.
   */
  public static getCreep(creep: Creep): CreepWrapper {
    const wrapperInstance = MemoryUtils.getCache<CreepWrapper>(`CreepWrapper_${creep.id}`);
    if (wrapperInstance) {
      return wrapperInstance;
    } else {
      let wrapper:
        | Worker
        | Harvester
        | Upgrader
        | Hauler
        | Builder
        | Claimer
        | Fixer
        | Importer
        | Guard
        | Raider
        | Scout
        | StoreMinder;
      switch (creep.memory.role) {
        case CreepRole.WORKER:
          wrapper = new Worker(creep);
          break;
        case CreepRole.HARVESTER:
          wrapper = new Harvester(creep);
          break;
        case CreepRole.UPGRADER:
          wrapper = new Upgrader(creep);
          break;
        case CreepRole.HAULER:
          wrapper = new Hauler(creep);
          break;
        case CreepRole.BUILDER:
          wrapper = new Builder(creep);
          break;
        case CreepRole.CLAIMER:
          wrapper = new Claimer(creep);
          break;
        case CreepRole.FIXER:
          wrapper = new Fixer(creep);
          break;
        case CreepRole.IMPORTER:
          wrapper = new Importer(creep);
          break;
        case CreepRole.GUARD:
          wrapper = new Guard(creep);
          break;
        case CreepRole.RAIDER:
          wrapper = new Raider(creep);
          break;
        case CreepRole.SCOUT:
          wrapper = new Scout(creep);
          break;
        case CreepRole.STORE_MINDER:
          wrapper = new StoreMinder(creep);
          break;

        default:
          assertNever(creep.memory.role);
      }
      MemoryUtils.setCache(`CreepWrapper_${creep.id}`, wrapper);
      return wrapper;

      function assertNever(x: never): never {
        throw new Error("Missing role handler: " + JSON.stringify(x));
      }
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
