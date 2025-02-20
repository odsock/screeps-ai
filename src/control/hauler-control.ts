import { CreepRole } from "config/creep-types";
import { SockPuppetConstants } from "config/sockpuppet-constants";
import { CreepUtils } from "creep-utils";
import { SpawnQueue } from "planning/spawn-queue";
import { Hauler } from "roles/hauler";
import { RoomWrapper } from "structures/room-wrapper";
import { SpawnUtils } from "./spawn-utils";
import { TaskManagement } from "./tasks/task-management";
import { CleanupTask } from "./tasks/cleanup-task";
import { HaulTask } from "./tasks/haul-task";
import { SupplyCreepTask } from "./tasks/supply-creep-task";
import { SupplySpawnTask } from "./tasks/supply-spawn-task";
import { Task } from "./tasks/task";
import { UnloadTask } from "./tasks/unload-task";
import { SupplyStructureTask } from "./tasks/supply-structure-task";

import { profile } from "../../screeps-typescript-profiler";

@profile
export class HaulerControl {
  public run(): void {
    for (const roomName in Game.rooms) {
      const roomw = RoomWrapper.getInstance(roomName);
      const haulers = _.filter(
        Game.creeps,
        c => !c.spawning && c.memory.role === Hauler.ROLE && c.memory.homeRoom === roomName
      ).map(c => new Hauler(c));
      const averageHaulerCapacity =
        (_.sum(haulers.map(c => c.getActiveBodyparts(CARRY))) * CARRY_CAPACITY) / haulers.length;

      if (haulers.length > 0) {
        TaskManagement.assignTasks(haulers, [
          ...this.createHaulTasks(roomw),
          ...this.createTowerSupplyTasks(roomw),
          ...this.createControllerSupplyTasks(roomw, averageHaulerCapacity),
          ...this.createSupplySpawnTasks(roomw, averageHaulerCapacity),
          ...this.createUnloadSourceContainerTasks(roomw),
          ...this.createSupplyCreepTasks(roomw),
          ...this.createCleanupTasks(roomw),
          ...this.createContainerCleanupTasks(roomw)
        ]);
      }

      if (roomw.controller?.my && roomw.spawns.length > 0) {
        this.requestSpawns(roomw);
      }
    }
  }

  /** clean up drops, tombs, ruins */
  private createCleanupTasks(roomw: RoomWrapper): CleanupTask[] {
    const tasks: CleanupTask[] = [];
    roomw
      .find(FIND_DROPPED_RESOURCES, {
        filter: d => d.amount > SockPuppetConstants.TASK_CLEANUP_THRESHOLD
      })
      .forEach(d =>
        tasks.push(
          new CleanupTask({
            pos: d.pos,
            targetId: d.id,
            priority: SockPuppetConstants.TASK_CLEANUP_PRIORITY
          })
        )
      );
    roomw
      .find(FIND_TOMBSTONES, {
        filter: t => t.store.getUsedCapacity() > SockPuppetConstants.TASK_CLEANUP_THRESHOLD
      })
      .forEach(t =>
        tasks.push(
          new CleanupTask({
            pos: t.pos,
            targetId: t.id,
            priority: SockPuppetConstants.TASK_CLEANUP_PRIORITY
          })
        )
      );
    roomw
      .find(FIND_RUINS, {
        filter: r => r.store.getUsedCapacity() > SockPuppetConstants.TASK_CLEANUP_THRESHOLD
      })
      .forEach(r =>
        tasks.push(
          new CleanupTask({
            pos: r.pos,
            targetId: r.id,
            priority: SockPuppetConstants.TASK_CLEANUP_PRIORITY
          })
        )
      );
    return tasks;
  }

  /** supply builders, upgraders */
  private createSupplyCreepTasks(roomw: RoomWrapper): SupplyCreepTask[] {
    const creepTypesToSupply = [CreepRole.BUILDER, CreepRole.WORKER];
    if (roomw.controllerContainers.length === 0) {
      creepTypesToSupply.push(CreepRole.UPGRADER);
    }
    return roomw.creeps
      .filter(
        c =>
          creepTypesToSupply.includes(c.memory.role) &&
          c.store.getFreeCapacity() > SockPuppetConstants.TASK_SUPPLY_CREEP_THRESHOLD
      )
      .map(
        c =>
          new SupplyCreepTask({
            targetId: c.id,
            creepName: c.name,
            priority: SockPuppetConstants.TASK_SUPPLY_CREEP_PRIORITY,
            pos: c.pos
          })
      );
  }

  /** unload source containers over threshold */
  private createUnloadSourceContainerTasks(roomw: RoomWrapper): UnloadTask[] {
    return roomw.sourceContainers
      .filter(
        c =>
          c.store.getUsedCapacity() >
          c.store.getCapacity() * SockPuppetConstants.TASK_UNLOAD_SOURCE_CONTAINER_THRESHOLD
      )
      .map(c => {
        return new UnloadTask({
          priority: SockPuppetConstants.TASK_UNLOAD_SOURCE_CONTAINER_PRIORITY,
          targetId: c.id,
          pos: c.pos,
          resourceType: RESOURCE_ENERGY
        });
      });
  }

  /** get non-energy resources out of containers */
  private createContainerCleanupTasks(roomw: RoomWrapper): UnloadTask[] {
    const tasks: UnloadTask[] = [];
    roomw.controllerContainers
      .concat(roomw.sourceContainers)
      .filter(c => c.store.energy < c.store.getUsedCapacity())
      .forEach(c => {
        CreepUtils.getStoreContents(c.store).forEach(resource => {
          tasks.push(
            new UnloadTask({
              priority: SockPuppetConstants.TASK_CONTAINER_CLEANUP_PRIORITY,
              targetId: c.id,
              pos: c.pos,
              resourceType: resource
            })
          );
        });
      });
    return tasks;
  }

  /** supply spawn/extensions if any capacity in room */
  private createSupplySpawnTasks(
    roomw: RoomWrapper,
    averageHaulerCapacity: number
  ): SupplySpawnTask[] {
    const spawns = roomw.spawns;
    const tasks: SupplySpawnTask[] = [];
    const capacityUsedRatio = roomw.getEnergyAvailable() / roomw.getEnergyCapacityAvailable();
    if (spawns.length > 0 && capacityUsedRatio < SockPuppetConstants.TASK_SUPPLY_SPAWN_THRESHOLD) {
      const haulersNeeded = capacityUsedRatio / averageHaulerCapacity;
      CreepUtils.consoleLogIfWatched(roomw, `supply spawn tasks: ${haulersNeeded}`);
      for (let i = 0; i < haulersNeeded; i++) {
        tasks.push(
          new SupplySpawnTask({
            priority: SockPuppetConstants.TASK_SUPPLY_SPAWN_PRIORITY,
            pos: spawns[0].pos,
            override: true,
            salt: i
          })
        );
      }
    }
    return tasks;
  }

  /** supply towers */
  private createTowerSupplyTasks(roomw: RoomWrapper): Task[] {
    return roomw.towers
      .filter(
        tower =>
          tower.store.getUsedCapacity(RESOURCE_ENERGY) / tower.store.getCapacity(RESOURCE_ENERGY) <
          SockPuppetConstants.TASK_SUPPLY_TOWER_THRESHOLD
      )
      .map(t => {
        return new SupplyStructureTask({
          targetId: t.id,
          pos: t.pos,
          priority: SockPuppetConstants.TASK_SUPPLY_TOWER_PRIORITY,
          resourceType: RESOURCE_ENERGY
        });
      });
  }

  /** supply controller container if have upgraders and no links*/
  private createControllerSupplyTasks(roomw: RoomWrapper, averageHaulerCapacity: number): Task[] {
    const upgraders = roomw.creeps.filter(c => c.memory.role === CreepRole.UPGRADER);
    if (upgraders.length === 0 || roomw.memory.controller?.link) {
      return [];
    }
    const containersBelowThreshold = roomw.controllerContainers.filter(
      container =>
        container.store.getUsedCapacity() <
        container.store.getCapacity() * SockPuppetConstants.TASK_SUPPLY_CONTROLLER_THRESHOLD
    );
    CreepUtils.consoleLogIfWatched(
      roomw,
      `controller supply: containers below threshold: ${containersBelowThreshold.length}`
    );
    const priority =
      roomw.controller?.ticksToDowngrade ?? 9999 < 1000
        ? SockPuppetConstants.TASK_SUPPLY_CONTROLLER_DOWNGRADE_PRIORITY
        : SockPuppetConstants.TASK_SUPPLY_CONTROLLER_PRIORITY;
    const tasks: SupplyStructureTask[] = [];
    containersBelowThreshold.forEach(c => {
      const haulersNeeded = c.store.getFreeCapacity() / averageHaulerCapacity;
      for (let i = 0; i < haulersNeeded; i++) {
        tasks.push(
          new SupplyStructureTask({
            tag: "supply controller container",
            targetId: c.id,
            pos: c.pos,
            priority,
            resourceType: RESOURCE_ENERGY,
            salt: i
          })
        );
      }
    });
    return tasks;
  }

  private createHaulTasks(roomw: RoomWrapper): HaulTask[] {
    const creeps = roomw.find(FIND_MY_CREEPS, {
      filter: creep =>
        creep.memory.haulRequested &&
        !creep.memory.haulerName &&
        creep.memory.targetRoom === roomw.name
    });
    const upgraderTasks: HaulTask[] = creeps
      .filter(c => c.memory.role === CreepRole.UPGRADER)
      .map(c => {
        return new HaulTask({
          creepName: c.name,
          targetId: c.id,
          pos: c.pos,
          priority: SockPuppetConstants.TASK_HAUL_UPGRADER_PRIORITY
        });
      });
    const storeMinderTasks: HaulTask[] = creeps
      .filter(c => c.memory.role === CreepRole.STORE_MINDER)
      .map(c => {
        return new HaulTask({
          creepName: c.name,
          targetId: c.id,
          pos: c.pos,
          priority: SockPuppetConstants.TASK_HAUL_STORE_MINDER_PRIORITY
        });
      });
    const priority =
      roomw.storage?.store.energy ?? -1 > 0
        ? SockPuppetConstants.TASK_HAUL_HARVESTER_PRIORITY
        : SockPuppetConstants.TASK_HAUL_HARVESTER_NO_ENERGY_PRIORITY;
    const harvesterTasks: HaulTask[] = creeps
      .filter(c => c.memory.role === CreepRole.HARVESTER)
      .map(c => {
        return new HaulTask({
          creepName: c.name,
          targetId: c.id,
          pos: c.pos,
          priority,
          override: true
        });
      });
    return [...upgraderTasks, ...harvesterTasks, ...storeMinderTasks];
  }

  private requestSpawns(roomw: RoomWrapper): void {
    const spawnQueue = SpawnQueue.getInstance(roomw);
    const spawnUtils = new SpawnUtils();
    const haulerCount = spawnUtils.getCreepCountForRole(roomw, Hauler.ROLE);

    // FIRST HAULER
    // always need at least one hauler to fill spawns and move harvesters
    if (haulerCount === 0) {
      spawnQueue.push({
        bodyProfile: Hauler.BODY_PROFILE,
        memory: { role: Hauler.ROLE },
        priority: 110
      });
    }

    // HAULER
    // spawn enough haulers to keep up with hauling needed
    const haulersRequired = roomw.sources.length;
    CreepUtils.consoleLogIfWatched(roomw, `haulers: ${haulerCount}/${haulersRequired}`);
    if (haulerCount < haulersRequired) {
      spawnQueue.push({
        bodyProfile: Hauler.BODY_PROFILE,
        max: true,
        memory: { role: Hauler.ROLE },
        priority: 85
      });
    }

    if (haulerCount <= haulersRequired) {
      spawnUtils.requestReplacementCreep(roomw, Hauler);
    }
  }
}
