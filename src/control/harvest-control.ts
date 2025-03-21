import { CreepUtils, LogLevel } from "creep-utils";
import { SpawnQueue } from "planning/spawn-queue";
import { Harvester } from "roles/harvester";
import { Hauler } from "roles/hauler";
import { RoomWrapper } from "structures/room-wrapper";
import { SpawnUtils } from "./spawn-utils";
import { TargetControl } from "./target-control";
import { profile } from "../../screeps-typescript-profiler";
import { PlannerUtils } from "planning/planner-utils";
import { MemoryUtils } from "planning/memory-utils";

@profile
export class HarvestControl {
  private readonly targetControl = TargetControl.getInstance();
  private readonly plannerUtils = PlannerUtils.getInstance();

  public run(): void {
    for (const roomName in Game.rooms) {
      const roomw = RoomWrapper.getInstance(roomName);

      if (roomw.controller?.my && roomw.spawns.length > 0) {
        this.requestSpawns(roomw);
        // TODO this won't scale for two claimed rooms, need to have home mapped for target config
        this.requestRemoteHarvesters(roomw);
        this.checkControllerMemory(roomw);
        this.checkSourceMemory(roomw);
      }
    }
  }

  // TODO add dropped and tomb to this?
  private energyInRoom(roomw: RoomWrapper): number {
    const storageEnergy = roomw.storage?.store.energy ?? 0;
    const sourceContainerEnergy = roomw.sourceContainers.reduce<number>(
      (sum, c) => (sum += c.store.energy),
      0
    );
    const controllerContainerEnergy = roomw.controllerContainers.reduce<number>(
      (sum, c) => (sum += c.store.energy),
      0
    );
    return storageEnergy + sourceContainerEnergy + controllerContainerEnergy;
  }

  /**
   * manage harvester population
   * should have enough to drain sources at regen time, and fit in harvest positions
   * */
  private requestSpawns(roomw: RoomWrapper): void {
    const spawnQueue = SpawnQueue.getInstance(roomw);
    const harvesters = roomw.find(FIND_MY_CREEPS, {
      filter: c => c.memory.role === Harvester.ROLE
    });

    // emergency harvester
    if (
      harvesters.length === 0 &&
      roomw.find(FIND_MY_CREEPS, { filter: c => c.memory.role === Hauler.ROLE }).length > 0 &&
      this.energyInRoom(roomw) === 0
    ) {
      CreepUtils.consoleLogIfWatched(roomw, `spawning emergency ${Harvester.ROLE}`);
      spawnQueue.push({
        bodyProfile: Harvester.BODY_PROFILE,
        memory: {
          role: Harvester.ROLE,
          source: roomw.sources[0].id
        },
        priority: 200
      });
    }

    for (const sourceId in roomw.memory.sources) {
      const source = Game.getObjectById(sourceId as Id<Source>);
      if (!source) {
        Game.notify(`ERROR: removed bad source id ${sourceId} in room ${roomw.name}`);
        delete roomw.memory.sources[sourceId];
        continue;
      }

      // spawn harvester capacity equal to source capacity
      const activeHarvestersOnSource = harvesters.filter(c => c.memory.source === sourceId);
      const spawningHarvestersOnSource = this.getSpawningHarvestersOnSource(roomw, sourceId);
      const creepCount = activeHarvestersOnSource.length + spawningHarvestersOnSource.length;
      const partCount =
        CreepUtils.countParts(WORK, ...activeHarvestersOnSource) +
        SpawnUtils.countSpawningParts(WORK, spawningHarvestersOnSource);
      const positionsForSource = roomw.memory.sources[sourceId].harvestPositions.length;
      const partsNeeded = source.energyCapacity / ENERGY_REGEN_TIME / HARVEST_POWER;
      CreepUtils.consoleLogIfWatched(
        roomw,
        `harvesters: ${creepCount}/${positionsForSource} positions, ${partCount}/${partsNeeded} parts`,
        undefined,
        LogLevel.DEBUG
      );
      const bodyProfile = roomw.memory.sources[sourceId].link
        ? Harvester.BODY_PROFILE_LINK
        : Harvester.BODY_PROFILE;
      if (creepCount < positionsForSource && partCount < partsNeeded) {
        CreepUtils.consoleLogIfWatched(
          roomw,
          `spawning ${Harvester.ROLE}`,
          undefined,
          LogLevel.DEBUG
        );
        const spawnRequest = {
          bodyProfile,
          max: true,
          memory: {
            role: Harvester.ROLE,
            source: sourceId as Id<Source>
          },
          priority: 90
        };
        spawnQueue.push(spawnRequest);
      }

      // replace harvester older than ticks to spawn replacement if at or below needed level
      if (creepCount <= positionsForSource && partCount <= partsNeeded) {
        const ticksToSpawn = SpawnUtils.calcSpawnTime(Harvester.BODY_PROFILE, roomw);
        const oldestCreep = CreepUtils.findOldestCreep(
          activeHarvestersOnSource.filter(creep => !creep.memory.retiring)
        );
        if (oldestCreep?.ticksToLive && oldestCreep.ticksToLive <= ticksToSpawn + 50) {
          CreepUtils.consoleLogIfWatched(
            roomw,
            `spawning replacement ${Harvester.ROLE}`,
            undefined,
            LogLevel.DEBUG
          );
          spawnQueue.push({
            bodyProfile,
            max: true,
            memory: {
              role: Harvester.ROLE,
              source: sourceId as Id<Source>,
              replacing: oldestCreep.name
            },
            priority: 90
          });
        }
      }
    }
  }

  private requestRemoteHarvesters(roomw: RoomWrapper): void {
    const spawnQueue = SpawnQueue.getInstance(roomw);

    const remoteHarvestRooms = this.targetControl.remoteHarvestRooms;
    const remoteHarvestRoomsMy =
      remoteHarvestRooms.filter(name => {
        return !Game.rooms[name]?.controller?.my;
      }) ?? [];
    for (const targetRoom of remoteHarvestRoomsMy) {
      const harvesters = _.filter(
        Game.creeps,
        c => c.memory.role === Harvester.ROLE && c.memory.targetRoom === targetRoom
      );
      const spawningHarvesters = this.getSpawningHarvestersForTarget(roomw, targetRoom);

      for (const sourceId in Memory.rooms[targetRoom]?.sources) {
        const hasMinder = [...spawningHarvesters, ...harvesters].some(
          h => h.memory.source === sourceId
        );
        if (!hasMinder) {
          CreepUtils.consoleLogIfWatched(
            roomw,
            `spawning remote harvester ${Harvester.ROLE}`,
            undefined,
            LogLevel.DEBUG
          );
          spawnQueue.push({
            bodyProfile: Harvester.BODY_PROFILE_REMOTE,
            max: true,
            memory: {
              role: Harvester.ROLE,
              source: sourceId as Id<Source>,
              targetRoom
            },
            priority: 50
          });
        }
      }
    }
  }

  private getSpawningHarvestersForTarget(roomw: RoomWrapper, targetRoom: string): SpawningInfo[] {
    const spawningHarvesters: SpawningInfo[] = [];
    roomw.spawns
      .filter(
        spawn =>
          spawn.memory.spawning?.memory.role === Harvester.ROLE &&
          spawn.memory.spawning?.memory.targetRoom === targetRoom
      )
      .forEach(spawn => {
        if (spawn.memory.spawning) {
          spawningHarvesters.push(spawn.memory.spawning);
        }
      });
    return spawningHarvesters;
  }

  private getSpawningHarvestersOnSource(roomw: RoomWrapper, sourceId: string): SpawningInfo[] {
    const spawning: SpawningInfo[] = [];
    roomw.spawns
      .filter(
        s =>
          s.spawning &&
          s.memory.spawning?.memory.role === Harvester.ROLE &&
          s.memory.spawning.memory.source === sourceId
      )
      .forEach(s => {
        if (s.memory.spawning) {
          spawning.push(s.memory.spawning);
        }
      });
    return spawning;
  }

  private checkControllerMemory(roomw: RoomWrapper): void {
    const controller = roomw.controller;
    if (!controller || !roomw.memory.controller) {
      return;
    }
    let containerInfo = roomw.memory.controller.container;
    let containerPos = undefined;
    if (containerInfo && this.plannerUtils.validateStructureInfo(containerInfo) === OK) {
      containerPos = MemoryUtils.unpackRoomPosition(containerInfo.pos);
    } else {
      containerInfo = undefined;
      const findResult = this.plannerUtils.findAdjacentStructure<StructureContainer>(
        controller.pos,
        STRUCTURE_CONTAINER
      );
      if (findResult) {
        containerPos = findResult.pos;
        containerInfo = {
          id: findResult.id,
          pos: MemoryUtils.packRoomPosition(findResult.pos),
          type: STRUCTURE_CONTAINER
        };
        roomw.memory.controller.container = containerInfo;
      }
    }

    const linkInfo = roomw.memory.controller.link;
    if ((!linkInfo || this.plannerUtils.validateStructureInfo(linkInfo) !== OK) && containerPos) {
      const findResult = this.plannerUtils.findAdjacentStructure<StructureLink>(
        containerPos,
        STRUCTURE_LINK
      );
      if (findResult) {
        roomw.memory.controller.link = {
          id: findResult.id,
          pos: MemoryUtils.packRoomPosition(findResult.pos),
          type: STRUCTURE_LINK
        };
      }
    }
  }

  private checkSourceMemory(roomw: RoomWrapper): void {
    for (const source of roomw.sources) {
      let containerInfo = roomw.memory.sources[source.id].container;
      let containerPos = undefined;
      if (containerInfo && this.plannerUtils.validateStructureInfo(containerInfo) === OK) {
        containerPos = MemoryUtils.unpackRoomPosition(containerInfo.pos);
      } else {
        containerInfo = undefined;
        const findResult = this.plannerUtils.findAdjacentStructure<StructureContainer>(
          source.pos,
          STRUCTURE_CONTAINER
        );
        if (findResult) {
          containerPos = findResult.pos;
          containerInfo = {
            id: findResult.id,
            pos: MemoryUtils.packRoomPosition(findResult.pos),
            type: STRUCTURE_CONTAINER
          };
          roomw.memory.sources[source.id].container = containerInfo;
        }
      }

      const linkInfo = roomw.memory.sources[source.id].link;
      if ((!linkInfo || this.plannerUtils.validateStructureInfo(linkInfo) !== OK) && containerPos) {
        const findResult = this.plannerUtils.findAdjacentStructure<StructureLink>(
          containerPos,
          STRUCTURE_LINK
        );
        if (findResult) {
          roomw.memory.sources[source.id].link = {
            id: findResult.id,
            pos: MemoryUtils.packRoomPosition(findResult.pos),
            type: STRUCTURE_LINK
          };
        }
      }
    }
  }
}
