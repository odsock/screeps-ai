import { CreepRole } from "config/creep-types";
import { CreepUtils } from "creep-utils";

import { CreepBodyProfile, CreepWrapper } from "./creep-wrapper";
import { TaskFactory } from "control/tasks/task-factory";

export class Hauler extends CreepWrapper {
  public static readonly ROLE = CreepRole.HAULER;
  public static readonly BODY_PROFILE: CreepBodyProfile = {
    profile: [MOVE, CARRY, CARRY],
    seed: [],
    maxBodyParts: MAX_CREEP_SIZE
  };

  public run(): void {
    const taskMemory = this.memory.task;
    if (!taskMemory) {
      CreepUtils.consoleLogIfWatched(this, `idle tick`, this.handleIdleTick());
      return;
    }
    const task = TaskFactory.create(taskMemory);
    CreepUtils.consoleLogIfWatched(this, `task: ${String(task.type)} pri ${String(task.priority)}`);
    if (!task.validate()) {
      CreepUtils.consoleLogIfWatched(this, `canceling invalid task`);
      task.cancel();
      this.completeTask();
      return;
    }
    CreepUtils.consoleLogIfWatched(this, `${task.type} result`, task.work(this));
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
  public loadEnergy(): ScreepsReturnCode {
    if (this.getActiveBodyparts(CARRY) === 0 || this.store.getFreeCapacity() === 0) {
      return ERR_FULL;
    }

    const target = this.findClosestSourceContainerFillsMyStore() ?? this.findClosestSourceContainerNotEmpty();
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
  public storeLoad(storageParam?: Creep | StructureWithStorage | undefined): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `storing load`);
    const storage = storageParam || this.findRoomStorage();
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
