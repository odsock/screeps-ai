import { CreepRole } from "config/creep-types";
import { CleanupTask, HaulTask, SupplyTask, TaskType, UnloadTask } from "control/task-management";
import { CreepUtils } from "creep-utils";
import { MemoryUtils } from "planning/memory-utils";

import { CreepBodyProfile, CreepWrapper } from "./creep-wrapper";

export class Hauler extends CreepWrapper {
  public static readonly ROLE = CreepRole.HAULER;
  public static readonly BODY_PROFILE: CreepBodyProfile = {
    profile: [MOVE, CARRY, CARRY],
    seed: [],
    maxBodyParts: MAX_CREEP_SIZE
  };

  public run(): void {
    CreepUtils.consoleLogIfWatched(
      this,
      `task: ${String(this.memory.task?.type)} pri ${String(this.memory.task?.priority)}`
    );
    const task = this.memory.task;
    switch (task?.type) {
      case TaskType.HAUL:
        CreepUtils.consoleLogIfWatched(this, `haul result`, this.workHaulTask(task));
        return;
      case TaskType.SUPPLY:
        CreepUtils.consoleLogIfWatched(this, `supply result`, this.workSupplyStructureTask(task));
        return;
      case TaskType.SUPPLY_SPAWN:
        CreepUtils.consoleLogIfWatched(this, `supply spawn result`, this.workSupplySpawnTask());
        return;
      case TaskType.UNLOAD:
        CreepUtils.consoleLogIfWatched(this, `unload container result`, this.workUnloadContainerJob(task));
        return;
      case TaskType.SUPPLY_CREEP:
        CreepUtils.consoleLogIfWatched(this, `supply creep result`, this.workSupplyCreepTask());
        return;
      case TaskType.CLEANUP:
        CreepUtils.consoleLogIfWatched(this, `cleanup result`, this.workCleanupTask(task));
        return;
      case undefined:
        CreepUtils.consoleLogIfWatched(this, `idle tick`, this.handleIdleTick());
        return;

      default:
        assertNever(task);
    }

    function assertNever(x: never): never {
      throw new Error("Missing task handler: " + JSON.stringify(x));
    }
  }

  private workUnloadContainerJob(task: UnloadTask): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `unload source container`);
    this.pickupAdjacentDroppedEnergy();
    this.withdrawAdjacentRuinOrTombEnergy();
    this.startWorkingIfEmpty();
    this.stopWorkingIfFull();

    // validate task
    const target = Game.getObjectById(task.targetId);
    if (!target || target.store.getUsedCapacity(task.resourceType) === 0) {
      this.completeTask();
      return ERR_INVALID_TARGET;
    }

    if (this.memory.working) {
      CreepUtils.consoleLogIfWatched(this, "working");
      const result = this.moveToAndGet(target, task.resourceType);
      CreepUtils.consoleLogIfWatched(this, `unload ${String(target)}`, result);
      if (result === OK) {
        this.memory.working = false;
      }
      return result;
    } else {
      CreepUtils.consoleLogIfWatched(this, `dumping`);
      const storage = this.findRoomStorage();
      if (storage) {
        const result = this.moveToAndTransfer(storage, task.resourceType);
        CreepUtils.consoleLogIfWatched(this, `dump at ${String(storage)}`, result);
        if (result === OK) {
          // one scoop completes task
          this.completeTask();
        }
        return result;
      }
      return ERR_FULL;
    }
  }

  private workCleanupTask(task: CleanupTask): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `cleanup drops/tombs/ruins`);
    this.pickupAdjacentDroppedEnergy();
    this.withdrawAdjacentRuinOrTombEnergy();
    this.startWorkingIfEmpty();
    this.stopWorkingIfFull();

    const target = Game.getObjectById(task.targetId);
    if (!target || (!(target instanceof Resource) && target.store.getUsedCapacity() === 0)) {
      this.completeTask();
      return ERR_INVALID_TARGET;
    }

    if (this.memory.working) {
      CreepUtils.consoleLogIfWatched(this, "working");
      let resourceType: ResourceConstant;
      if (!(target instanceof Resource)) {
        const resources = CreepUtils.getStoreContents(target);
        resourceType = resources[0];
      } else {
        resourceType = target.resourceType;
      }
      const result = this.moveToAndGet(target, resourceType);
      if (result === OK) {
        return result;
      }
      CreepUtils.consoleLogIfWatched(this, `cleanup`, result);
      return result;
    } else {
      return this.storeLoad();
    }
  }

  private workSupplyCreepTask(): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `supply creeps`);
    this.pickupAdjacentDroppedEnergy();
    this.withdrawAdjacentRuinOrTombEnergy();
    this.stopWorkingIfEmpty();
    this.startWorkingIfFull();

    const creeps = this.roomw.creeps.filter(
      c => [CreepRole.BUILDER, CreepRole.UPGRADER, CreepRole.WORKER].includes(c.memory.role) && c.store.energy === 0
    );
    if (creeps.length === 0) {
      this.completeTask();
      return ERR_NOT_FOUND;
    }

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
        roomCallback: this.costMatrixUtils.creepMovementRoomCallback
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

    // TODO check size of creep to haul vs store used before waiting to dump
    if (this.store.getUsedCapacity() > 0) {
      return this.storeLoad();
    }

    // start working when near cargo
    if (this.pos.isNearTo(creepToHaul.pos)) {
      this.memory.working = true;
    } else if (this.memory.working && !this.memory.exitState) {
      // if not near cargo, and not in exit proccess, need to walk back to cargo
      this.memory.working = false;
    }

    if (!this.memory.working) {
      // step away from exit if just crossed over and not hauling yet. Prevents room swap loop with cargo creep.
      if (this.memory.lastPos && this.pos.roomName !== MemoryUtils.unpackRoomPosition(this.memory.lastPos).roomName) {
        const exitDir = CreepUtils.getClosestExitDirection(this.pos);
        if (exitDir) {
          const reverseExitDir = CreepUtils.reverseDirection(exitDir);
          const result = this.moveW(reverseExitDir);
          CreepUtils.consoleLogIfWatched(this, `move away from exit`, result);
          return result;
        }
      }
      const result = this.moveToW(creepToHaul);
      CreepUtils.consoleLogIfWatched(this, `move to creep`, result);
    }
    return OK;
  }

  private workSupplyStructureTask(supplyTask: SupplyTask): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `supply structure`);

    const target = Game.getObjectById(supplyTask.targetId);
    if (!target) {
      return ERR_INVALID_TARGET;
    }

    if (target.store.getFreeCapacity() === 0) {
      this.completeTask();
      return ERR_FULL;
    }

    this.pickupAdjacentDroppedEnergy();
    this.withdrawAdjacentRuinOrTombEnergy();

    // TODO maybe store non-energy here

    this.stopWorkingIfEmpty();
    this.startWorkingIfFull();
    this.startWorkingInRange(target.pos, 1);

    if (this.memory.working) {
      CreepUtils.consoleLogIfWatched(this, "working");
      if (!this.pos.isNearTo(target)) {
        const moveResult = this.moveToW(target, { range: 1, visualizePathStyle: { stroke: "#ffffff" } });
        CreepUtils.consoleLogIfWatched(this, `moving to ${target.structureType} at ${String(target.pos)}`, moveResult);
        return moveResult;
      } else {
        const transferResult = this.transfer(target, supplyTask.resourceType);
        CreepUtils.consoleLogIfWatched(this, `transfer result`, transferResult);

        let targetFreeCap = 0;
        // Type issue, two different versions of getFreeCapacity. The if makes compiler happy.
        if (target instanceof OwnedStructure) {
          targetFreeCap = target.store.getFreeCapacity(supplyTask.resourceType);
        } else {
          targetFreeCap = target.store.getFreeCapacity(supplyTask.resourceType);
        }
        const creepStoredResource = this.store.getUsedCapacity(supplyTask.resourceType);
        // stop if structure will be full after this transfer
        if (transferResult === OK && targetFreeCap < creepStoredResource) {
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

  // When supplying spawn, use priority to prefer storage
  private workSupplySpawnTask(): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `supply for spawning`);
    this.pickupAdjacentDroppedEnergy();
    this.withdrawAdjacentRuinOrTombEnergy();
    this.stopWorkingIfEmpty();
    this.startWorkingIfNotEmpty();

    if (this.memory.working) {
      CreepUtils.consoleLogIfWatched(this, "working");
      const spawnStorage = this.roomw.spawnStorage.filter(s => s.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
      if (spawnStorage.length === 0) {
        this.completeTask();
        return ERR_FULL;
      }

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
      roomCallback: this.costMatrixUtils.creepMovementRoomCallback
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
    CreepUtils.consoleLogIfWatched(this, `stumped. Abandoning task.`);
    this.completeTask();
    return ERR_NOT_FOUND;
  }

  /** finds storage and unloads creep there if carrying */
  private storeLoad(): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `storing load`);
    const storage = this.findRoomStorage();
    if (storage) {
      const resources = this.getStoreContents();
      if (resources.length > 0) {
        const result = this.moveToAndTransfer(storage, resources[0]);
        CreepUtils.consoleLogIfWatched(this, `store at ${String(storage)}`, result);
        return result;
      }
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

  private handleIdleTick(): ScreepsReturnCode {
    this.pickupAdjacentDroppedEnergy();
    this.withdrawAdjacentRuinOrTombEnergy();

    if (this.room.name !== this.memory.homeRoom) {
      return this.moveToRoom(this.memory.homeRoom);
    }

    this.say("🤔");
    const idleZone = this.findIdleZone();
    if (idleZone) {
      let path = PathFinder.search(
        this.pos,
        { pos: idleZone, range: 3 },
        { roomCallback: this.costMatrixUtils.creepMovementRoomCallback }
      );
      if (!path.incomplete && path.path.length === 0) {
        path = PathFinder.search(
          this.pos,
          { pos: idleZone, range: 3 },
          { flee: true, roomCallback: this.costMatrixUtils.creepMovementRoomCallback }
        );
      }
      if (!path.incomplete && path.path.length > 0) {
        const result = this.moveByPath(path.path);
        CreepUtils.consoleLogIfWatched(this, `moving to idle zone: ${String(idleZone)}`, result);
        return result;
      }
    }

    CreepUtils.consoleLogIfWatched(this, `stumped. Just going to sit here.`);
    return OK;
  }
}
