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

  public run(): void {
    this.moveToDestination();

    // retire old creep if valid retiree set
    if (this.memory.retiree) {
      const retiree = Game.creeps[this.memory.retiree];
      if (retiree) {
        this.retireCreep(retiree);
        return;
      } else {
        this.memory.retiree = undefined;
      }
    }

    // harvest if possible
    if (this.harvestFromNearbySource() === OK) {
      return;
    }

    CreepUtils.consoleLogIfWatched(this, `stumped. sitting like a lump`);
  }

  public moveToDestination(): ScreepsReturnCode {
    // move to claimed container if it exists
    const container = this.getMyContainer();
    if (container) {
      CreepUtils.consoleLogIfWatched(this, `finding path to source container`);
      return this.directHauler(container.pos, {});
    }

    // move to chosen source if no container claim
    const source = this.getMySource();
    if (source) {
      CreepUtils.consoleLogIfWatched(this, `finding path to source`);
      return this.directHauler(source.pos, { range: 1 });
    }

    // nowhere to move
    CreepUtils.consoleLogIfWatched(this, `stumped. no source to harvest.`);
    return ERR_INVALID_TARGET;
  }

  private directHauler(target: RoomPosition, findPathOpts: FindPathOpts): ScreepsReturnCode {
    // cancel hauler call if at target
    const myPathToTarget = this.pos.findPathTo(target, findPathOpts);
    if (myPathToTarget.length === 0) {
      this.cancelHauler();
      return OK;
    }

    // call a hauler if not at target yet
    CreepUtils.consoleLogIfWatched(this, `calling hauler for path`);
    this.callHauler();

    // if we have a hauler, tell it where to go
    if (this.memory.haulerName) {
      const hauler = Game.creeps[this.memory.haulerName];
      if (hauler) {
        CreepUtils.consoleLogIfWatched(this, `already have a hauler`);
        // setup hauler pulling
        const pullResult = hauler.pull(this);
        const moveResult = this.move(hauler);
        if (pullResult === OK && moveResult === OK) {
          // get haulers path to target
          const haulerPathToTarget = hauler.pos.findPathTo(target, findPathOpts);

          // if path is 0 steps, hauler is at target, so swap positions
          if (haulerPathToTarget.length === 0) {
            const result = hauler.moveTo(this);
            CreepUtils.consoleLogIfWatched(this, `haul last step`, result);
            return result;
          }

          // move hauler along the path
          const haulResult = hauler.moveByPath(haulerPathToTarget);
          CreepUtils.consoleLogIfWatched(this, `haul`, haulResult);
        } else {
          CreepUtils.consoleLogIfWatched(this, `failed to pull. pull ${pullResult}, move ${moveResult}`);
          return ERR_INVALID_ARGS;
        }
      } else {
        this.cancelHauler();
        return ERR_INVALID_TARGET;
      }
    }
    return OK;
  }

  /** get source from my memory or choose one*/
  private getMySource(): Source | undefined {
    if (this.memory.source) {
      const source = Game.getObjectById(this.memory.source);
      if (source) {
        return source;
      }
    }

    CreepUtils.consoleLogIfWatched(this, `choosing source`);

    for (const source of this.roomw.sources) {
      const harvestersOnSource = this.room.find(FIND_MY_CREEPS, {
        filter: creep => creep.memory.role === Harvester.ROLE && creep.memory.source === source.id
      });
      const workPartsOnSource = CreepUtils.countParts(WORK, ...harvestersOnSource);
      const harvestPositionsAtSource = this.roomw.getHarvestPositions(source.id).length;
      const WORK_PARTS_PER_SOURCE = 5;
      if (harvestersOnSource.length < harvestPositionsAtSource && workPartsOnSource < WORK_PARTS_PER_SOURCE) {
        this.memory.source = source.id;
        return source;
      }
    }
    return undefined;
  }

  /** get container from my memory or claim one*/
  protected getMyContainer(): StructureContainer | undefined {
    if (this.memory.containerId) {
      const container = Game.getObjectById(this.memory.containerId);
      if (container) {
        return container;
      }
      this.memory.containerId = undefined;
      CreepUtils.consoleLogIfWatched(this, `container id invalid`);
    }

    if (this.memory.source) {
      const sourceInfo = this.roomw.memory.sources[this.memory.source];
      if (!sourceInfo) {
        this.memory.source = undefined;
        CreepUtils.consoleLogIfWatched(this, `source id invalid`);
        return undefined;
      }

      const containerId = sourceInfo.containerId;
      if (containerId && (!sourceInfo.minderId || sourceInfo.minderId === this.id)) {
        CreepUtils.consoleLogIfWatched(this, `claimed source container: ${containerId}`);
        const container = Game.getObjectById(containerId);
        if (container) {
          sourceInfo.minderId = this.id;
          this.memory.containerId = containerId;
          return container;
        }
        this.memory.containerId = undefined;
        CreepUtils.consoleLogIfWatched(this, `container id invalid`);
      }
    }

    CreepUtils.consoleLogIfWatched(this, `no free source containers`);
    return undefined;
  }
}
