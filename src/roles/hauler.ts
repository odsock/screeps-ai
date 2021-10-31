import { CreepRole } from "config/creep-types";
import { HaulTask, SupplyTask, TaskType, UnloadTask } from "control/hauler-control";
import { CreepUtils } from "creep-utils";
import { CostMatrixUtils } from "utils/cost-matrix-utils";
import { profile } from "../../screeps-typescript-profiler";
import { Builder } from "./builder";
import { CreepBodyProfile, CreepWrapper } from "./creep-wrapper";
import { Upgrader } from "./upgrader";

@profile
export class Hauler extends CreepWrapper {
  public static readonly ROLE = CreepRole.HAULER;
  public static readonly BODY_PROFILE: CreepBodyProfile = {
    profile: [MOVE, CARRY, CARRY],
    seed: [],
    maxBodyParts: MAX_CREEP_SIZE
  };

  public run(): void {
    /**
     * hauler jobs:
     * tug minders
     * fill spawn
     * fill towers
     * empty source containers
     * fill builders
     * fill controller container
     * fill upgraders
     * cleanup drops, tombs, ruins
     */

    if (this.memory.task) {
      const task = this.memory.task;
      switch (task.type) {
        case TaskType.HAUL:
          CreepUtils.consoleLogIfWatched(this, `haul result`, this.workHaulTask(task));
          return;
        case TaskType.SUPPLY:
          CreepUtils.consoleLogIfWatched(this, `supply result`, this.supplyStructureJob(task));
          return;
        case TaskType.SUPPLY_SPAWN:
          CreepUtils.consoleLogIfWatched(this, `supply spawn result`, this.workSupplySpawnTask());
          return;
        case TaskType.UNLOAD:
          CreepUtils.consoleLogIfWatched(this, `unload container result`, this.workUnloadContainerJob(task));
          return;

        default:
          assertNever(task);
      }
    }

    // pickup convenient energy
    this.pickupAdjacentDroppedEnergy();
    this.withdrawAdjacentRuinOrTombEnergy();

    // supply empty builders
    const builders = this.room.find(FIND_MY_CREEPS, {
      filter: creep => creep.memory.role === Builder.ROLE && creep.store.getUsedCapacity() === 0
    });
    if (builders.length > 0) {
      this.supplyCreepsJob(builders);
      return;
    }

    // supply empty upgraders
    const upgraders = this.room.find(FIND_MY_CREEPS, {
      filter: creep => creep.memory.role === Upgrader.ROLE && creep.store.getUsedCapacity() === 0
    });
    if (upgraders.length > 0) {
      this.supplyCreepsJob(upgraders);
      return;
    }

    // clean up drops, tombs, ruins
    const cleanupResult = this.cleanupJob();
    if (cleanupResult === OK) {
      return;
    }

    // idle
    this.updateJob(`idle`);
    this.say("🤔");
    const idleZone = this.findIdleZone();
    if (idleZone) {
      this.moveTo(idleZone, { range: 2, reusePath: 10 });
      return;
    }

    CreepUtils.consoleLogIfWatched(this, `stumped. Just going to sit here.`);

    function assertNever(x: never): never {
      throw new Error("Missing task handler: " + JSON.stringify(x));
    }
  }

  private workUnloadContainerJob(task: UnloadTask): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `unload source container`);
    this.updateJob(`source`);
    this.startWorkingIfEmpty();
    this.stopWorkingIfFull();

    // validate task
    const target = Game.getObjectById(task.containerId);
    if (!target || target.store.getUsedCapacity() === 0) {
      this.completeTask();
      return ERR_INVALID_TARGET;
    }

    if (this.memory.working) {
      CreepUtils.consoleLogIfWatched(this, "working");
      const result = this.moveToAndGet(target);
      CreepUtils.consoleLogIfWatched(this, `unload ${String(target)}`, result);
      return result;
    } else {
      CreepUtils.consoleLogIfWatched(this, `dumping`);
      const storage = this.findRoomStorage();
      if (storage) {
        const result = this.moveToAndTransfer(storage);
        CreepUtils.consoleLogIfWatched(this, `dump at ${String(storage)}`, result);
        return result;
      }
      return ERR_FULL;
    }
  }

  private cleanupJob(): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `cleanup drops/tombs/ruins`);
    this.updateJob(`cleanup`);
    this.startWorkingIfEmpty();
    this.stopWorkingIfFull();

    if (this.memory.working) {
      CreepUtils.consoleLogIfWatched(this, "working");
      const result = this.cleanupDropsTombsRuins();
      CreepUtils.consoleLogIfWatched(this, `cleanup`, result);
      return result;
    } else {
      return this.storeLoad();
    }
  }

  private supplyCreepsJob(creeps: Creep[]) {
    CreepUtils.consoleLogIfWatched(this, `supply creeps`);
    this.updateJob(`creeps`);
    this.stopWorkingIfEmpty();
    this.startWorkingIfFull();

    if (this.memory.working) {
      CreepUtils.consoleLogIfWatched(this, "working");
      const target = creeps.find(creep => creep.pos.isNearTo(this.pos));
      if (target) {
        const transferResult = this.transfer(target, RESOURCE_ENERGY);
        CreepUtils.consoleLogIfWatched(this, `supply ${target.name} result`, transferResult);
        // stores do NOT reflect transfer above until next tick
        const targetFreeCap = target.store.getFreeCapacity(RESOURCE_ENERGY);
        const creepStoredEnergy = this.store.getUsedCapacity(RESOURCE_ENERGY);
        if (transferResult === OK && targetFreeCap >= creepStoredEnergy) {
          CreepUtils.consoleLogIfWatched(this, `empty`);
          const loadResult = this.loadEnergy();
          return loadResult;
        }
      }
      // get path through all creeps
      const goals = creeps.map(creep => {
        return { pos: creep.pos, range: 1 };
      });
      const path = PathFinder.search(this.pos, goals, {
        plainCost: 2,
        swampCost: 10,
        roomCallback: CostMatrixUtils.getCreepMovementCostMatrix
      });
      CreepUtils.consoleLogIfWatched(this, `path: ${String(path.path)}`);
      const moveResult = this.moveByPath(path.path);
      CreepUtils.consoleLogIfWatched(this, `moving on path`, moveResult);
      return moveResult;
    } else {
      const loadResult = this.loadEnergy();
      return loadResult;
    }
  }

  private workHaulTask(haulTask: HaulTask): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `haul ${String(haulTask.creepName)}`);
    this.updateJob(`tug`);

    // TODO validation here may cause idle tick when haul ends
    CreepUtils.consoleLogIfWatched(this, `validate haul request `);
    const creepToHaul = Game.creeps[haulTask.creepName];
    if (!creepToHaul || !creepToHaul.memory.haulRequested) {
      CreepUtils.consoleLogIfWatched(this, `haul request invalid`);
      if (creepToHaul) {
        creepToHaul.memory.haulRequested = false;
        creepToHaul.memory.haulerName = undefined;
      }
      this.completeTask();
      return ERR_INVALID_TARGET;
    } else {
      creepToHaul.memory.haulerName = this.name;
    }

    if (this.store.getUsedCapacity() > 0) {
      return this.storeLoad();
    }

    if (this.pos.isNearTo(creepToHaul.pos)) {
      this.memory.working = true;
    } else {
      this.memory.working = false;
    }

    if (!this.memory.working) {
      const result = this.moveTo(creepToHaul);
      CreepUtils.consoleLogIfWatched(this, `move to creep`, result);
    }
    return OK;
  }

  private supplyStructureJob(supplyTask: SupplyTask): ScreepsReturnCode {
    // pickup convenient energy
    this.pickupAdjacentDroppedEnergy();
    this.withdrawAdjacentRuinOrTombEnergy();

    const target = Game.getObjectById(supplyTask.target as Id<StructureWithStorage>);
    if (!target) {
      return ERR_INVALID_TARGET;
    }

    if (target.store.getFreeCapacity() === 0) {
      this.completeTask();
      return ERR_FULL;
    }

    CreepUtils.consoleLogIfWatched(this, `supply ${target.structureType}`);
    this.updateJob(`${target.structureType}`);
    this.stopWorkingIfEmpty();
    this.startWorkingIfFull();
    this.startWorkingInRange(target.pos, 1);

    if (this.memory.working) {
      CreepUtils.consoleLogIfWatched(this, "working");
      if (!this.pos.isNearTo(target)) {
        const moveResult = this.moveTo(target, { range: 1, reusePath: 10, visualizePathStyle: { stroke: "#ffffff" } });
        CreepUtils.consoleLogIfWatched(this, `moving to ${target.structureType} at ${String(target.pos)}`, moveResult);
        return moveResult;
      } else {
        const transferResult = this.transfer(target, RESOURCE_ENERGY);
        CreepUtils.consoleLogIfWatched(this, `transfer result`, transferResult);

        let targetFreeCap = 0;
        // Type issue, two different versions of getFreeCapacity. The if makes compiler happy.
        if (target instanceof OwnedStructure) {
          targetFreeCap = target.store.getFreeCapacity(RESOURCE_ENERGY);
        } else {
          targetFreeCap = target.store.getFreeCapacity(RESOURCE_ENERGY);
        }
        const creepStoredEnergy = this.store.getUsedCapacity(RESOURCE_ENERGY);
        // stop if structure will be full after this transfer
        if (transferResult === OK && targetFreeCap < creepStoredEnergy) {
          CreepUtils.consoleLogIfWatched(this, `${target.structureType} is full: ${String(target.pos)}`);
          this.completeTask();
        }
        return transferResult;
      }
    } else {
      // TODO when no energy found, try to work when partly full
      const result = this.loadEnergy();
      // if can't get energy, cancel task
      if (result === ERR_NOT_FOUND) {
        this.completeTask();
      }
      return result;
    }
  }

  private completeTask(): void {
    CreepUtils.consoleLogIfWatched(this, `task complete: ${String(this.memory.task?.type)}`);
    delete this.memory.task;
  }

  // When supplying spawn, use priority to prefer storage
  private workSupplySpawnTask(): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `supply for spawning`);
    this.updateJob(`spawn`);
    this.stopWorkingIfEmpty();
    this.startWorkingIfNotEmpty();

    this.pickupAdjacentDroppedEnergy();
    this.withdrawAdjacentRuinOrTombEnergy();

    if (this.memory.working) {
      CreepUtils.consoleLogIfWatched(this, "working");
      const spawnStorage = this.roomw.spawnStorage.filter(s => s.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
      if (spawnStorage.length === 0) {
        this.completeTask();
        return ERR_FULL;
      }
      // update task with current state

      const targetIndex = spawnStorage.findIndex(s => s.pos.isNearTo(this.pos));
      if (targetIndex !== -1) {
        const target = spawnStorage[targetIndex];
        const transferResult = this.transfer(target, RESOURCE_ENERGY);
        CreepUtils.consoleLogIfWatched(this, `supply ${target.structureType} result`, transferResult);
        // stores do NOT reflect transfer above until next tick
        const targetFreeCap = target.store.getFreeCapacity(RESOURCE_ENERGY);
        const creepStoredEnergy = this.store.getUsedCapacity(RESOURCE_ENERGY);
        if (transferResult === OK) {
          // go find more energy if empty
          if (targetFreeCap >= creepStoredEnergy) {
            CreepUtils.consoleLogIfWatched(this, `empty`);
            const harvestResult = this.harvestByPriority();
            return harvestResult;
          }
        }
      }
      // get path through remaining extensions
      const path = this.getSpawnSupplyPath(spawnStorage);
      CreepUtils.consoleLogIfWatched(this, `path: ${String(path)}`);
      const moveResult = this.moveByPath(path);
      CreepUtils.consoleLogIfWatched(this, `moving on path`, moveResult);
      return moveResult;
    } else {
      const harvestResult = this.harvestByPriority();
      return harvestResult;
    }
  }

  private getSpawnSupplyPath(spawnStorage: (StructureExtension | StructureSpawn)[]): RoomPosition[] {
    // if (this.memory.path) {
    //   return Room.deserializePath(this.memory.path);
    // }
    const goals = spawnStorage.map(s => {
      return { pos: s.pos, range: 1 };
    });
    CreepUtils.consoleLogIfWatched(this, `path goals: ${JSON.stringify(goals)}`);
    const path = PathFinder.search(this.pos, goals, {
      plainCost: 2,
      swampCost: 10,
      roomCallback: CostMatrixUtils.getCreepMovementCostMatrix
    });

    // this.memory.path = path.path
    //   .map((pos, index, array) => {
    //     if (index === 0) {
    //       return `${pos.x}${pos.y}${this.pos.getDirectionTo(pos.x, pos.y)}`;
    //     }
    //     return `${array[index - 1].getDirectionTo(pos.x, pos.y)}`;
    //   })
    //   .join("");
    if (path.incomplete) {
      CreepUtils.consoleLogIfWatched(this, `supply path incomplete`);
    }
    return path.path;
  }

  private cleanupDropsTombsRuins() {
    if (this.store.getFreeCapacity() === 0) {
      return ERR_FULL;
    }

    let result = this.moveToAndGet(this.findClosestEnergyDrop());
    if (result === OK) {
      return result;
    }

    result = this.moveToAndGet(this.findClosestTombstoneWithEnergy());
    if (result === OK) {
      return result;
    }

    result = this.moveToAndGet(this.findClosestRuinsWithEnergy());
    if (result === OK) {
      return result;
    }

    return ERR_NOT_FOUND;
  }

  /**
   * finds energy in room in order:
   * adjacent drop, ruin, or tomb
   * source container that fills my storage
   * storage
   * drop large enough to fill
   * tomb
   * ruin
   */
  private loadEnergy(): ScreepsReturnCode {
    if (this.getActiveBodyparts(CARRY) === 0 || this.store.getFreeCapacity() === 0) {
      return ERR_FULL;
    }

    const target = this.findClosestSourceContainerFillsMyStore();
    let result = this.moveToAndGet(target);
    if (result === OK) {
      return result;
    }

    if (this.room.storage && this.room.storage.store.energy > 0) {
      result = this.moveToAndGet(this.room.storage);
      if (result === OK) {
        return result;
      }
    }

    result = this.cleanupDropsTombsRuins();
    if (result === OK) {
      return result;
    }

    this.say("🤔");
    CreepUtils.consoleLogIfWatched(this, `stumped. Just going to sit here.`);
    return ERR_NOT_FOUND;
  }

  /** finds storage and unloads creep there if carrying */
  private storeLoad(): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `storing load`);
    const storage = this.findRoomStorage();
    if (storage) {
      const result = this.moveToAndTransfer(storage);
      CreepUtils.consoleLogIfWatched(this, `store at ${String(storage)}`, result);
      return result;
    }
    return ERR_FULL;
  }

  private findClosestSourceContainerFillsMyStore() {
    const sourceContainers: StructureContainer[] = [];
    _.forEach(this.roomw.memory.sources, s => {
      const container = s.containerId ? Game.getObjectById(s.containerId) : undefined;
      if (container && container.store.energy >= this.store.getCapacity()) {
        sourceContainers.push(container);
      }
    });
    const target = this.pos.findClosestByPath(sourceContainers) ?? undefined;
    return target;
  }

  private findIdleZone(): RoomPosition | undefined {
    if (this.memory.idleZone) {
      const target = Game.getObjectById(this.memory.idleZone);
      if (target) {
        return target.pos;
      }
      this.memory.idleZone = undefined;
    }

    const occupiedIdleZones: string[] = this.getOccupiedIdleZones();
    const unoccupiedIdleZones: (StructureStorage | StructureSpawn | Source)[] = [];

    // next to storage
    const storage = this.roomw.storage;
    if (storage) {
      if (occupiedIdleZones.indexOf(storage.id) === -1) {
        unoccupiedIdleZones.push(storage);
      }
    } else {
      // next to spawn
      const spawns = this.roomw.spawns.filter(s => occupiedIdleZones.indexOf(s.id) === -1);
      if (spawns.length > 0) {
        const closestSource = this.pos.findClosestByPath(spawns, { range: 2 });
        if (closestSource) {
          unoccupiedIdleZones.push(closestSource);
        }
      }
    }

    // next to source
    const sources = this.roomw.sources.filter(s => occupiedIdleZones.indexOf(s.id) === -1);
    if (sources.length > 0) {
      const closestSource = this.pos.findClosestByPath(sources, { range: 2 });
      if (closestSource) {
        unoccupiedIdleZones.push(closestSource);
      }
    }

    // pick closest option
    if (unoccupiedIdleZones.length > 0) {
      const closestIdleZone = this.pos.findClosestByPath(unoccupiedIdleZones, { range: 2 });
      if (closestIdleZone) {
        this.memory.idleZone = closestIdleZone.id;
        return closestIdleZone.pos;
      }
    }

    return undefined;
  }

  private getOccupiedIdleZones() {
    const occupiedIdleZones: string[] = [];
    this.roomw
      .find(FIND_MY_CREEPS, {
        filter: c => c.memory.role === CreepRole.HAULER
      })
      .forEach(c => {
        if (c.memory.idleZone) {
          occupiedIdleZones.push(c.memory.idleZone);
        }
      });
    return occupiedIdleZones;
  }
}
