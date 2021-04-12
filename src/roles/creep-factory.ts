import { CreepWrapper } from "./creep-wrapper";
import { Worker } from "./worker";
import { Harvester } from "./harvester";
import { Upgrader } from "./upgrader";
import { Hauler } from "./hauler";
import { Builder } from "./builder";
import { Claimer } from "./claimer";

export class CreepFactory {
  public static getCreep(creep: Creep): CreepWrapper {
    switch (creep.memory.role) {
      case "worker":
        return new Worker(creep);
      case "harvester":
        return new Harvester(creep);
      case "upgrader":
        return new Upgrader(creep);
      case "hauler":
        return new Hauler(creep);
      case "builder":
        return new Builder(creep);
      case "claimer":
        return new Claimer(creep);

      default:
        throw new Error(`Unknown creep role: ${creep.memory.role}`);
    }
  }
}
