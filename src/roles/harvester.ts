import { CreepRole } from "config/creep-types";
import { CreepUtils } from "creep-utils";
import { Minder } from "./minder";

export class Harvester extends Minder {
  public static ROLE: CreepRole = CreepRole.HARVESTER;
  public static BODY_PROFILE: CreepBodyProfile = {
    profile: [WORK],
    seed: [],
    maxBodyParts: 5
  };

  public moveToDestination(): ScreepsReturnCode {
    let path;
    // move to claimed container if it exists
    const containerId = this.claimSourceContainer();
    if (containerId) {
      const container = Game.getObjectById(containerId);
      if (container) {
        path = this.pos.findPathTo(container);
      }
    }

    // choose source if no container
    if (!this.memory.source) {
      const sourceId = this.claimSource();
      if (sourceId) {
        const source = Game.getObjectById(sourceId);
        if (source) {
          path = this.pos.findPathTo(source, { range: 1 });
        }
      }
    }

    if (path && path.length > 0) {
      this.callTug();
      if (this.memory.haulerName) {
        const hauler = Game.creeps[this.memory.haulerName];
        if (hauler) {
          const pullResult = hauler.pull(this);
          const moveResult = this.moveTo(hauler);
          if (pullResult === OK && moveResult === OK) {
            if (path.length === 1) {
              return hauler.moveTo(this);
            }
            return hauler.moveByPath(path);
          } else {
            CreepUtils.consoleLogIfWatched(this, `failed to pull. pull ${pullResult}, move ${moveResult}`);
            return ERR_INVALID_ARGS;
          }
        } else {
          this.cancelTug();
        }
      }
    }

    return OK;
  }

  private claimSource(): Id<Source> | undefined {
    CreepUtils.consoleLogIfWatched(this, `choosing source`);
    const harvestersBySource: { [id: string]: Creep[] } = {};
    this.room.find(FIND_SOURCES).forEach(source => (harvestersBySource[source.id] = []));
    this.room.find(FIND_MY_CREEPS, { filter: creep => creep.memory.role === Harvester.ROLE }).forEach(creep => {
      if (creep.memory.source) {
        harvestersBySource[creep.memory.source].push(creep);
      }
    });

    for (const source in harvestersBySource) {
      const sourceId = source as Id<Source>;
      const harvesters = harvestersBySource[sourceId];
      const workParts = CreepUtils.countParts(WORK, ...harvesters);
      const harvestPositions = this.roomw.getHarvestPositions(sourceId).length;
      const WORK_PARTS_PER_SOURCE = 5;
      if (harvesters.length < harvestPositions && workParts < WORK_PARTS_PER_SOURCE) {
        this.memory.source = sourceId;
        return sourceId;
      }
    }
    return undefined;
  }
}
