import { CreepRole } from "config/creep-types";
import { CreepUtils } from "creep-utils";
import { MemoryUtils } from "planning/memory-utils";
import { SpawnQueue } from "planning/spawn-queue";
import { Claimer } from "roles/claimer";
import { CreepFactory } from "roles/creep-factory";
import { Importer } from "roles/importer";
import { Worker } from "roles/worker";
import { RoomWrapper } from "structures/room-wrapper";
import { SpawnUtils } from "./spawn-utils";
import { TargetControl } from "./target-control";
import { TaskManagement } from "./tasks/task-management";
import { HaulTask } from "./tasks/haul-task";
import { CreepBodyUtils } from "roles/creep-body-utils";
import { CreepWrapper } from "roles/creep-wrapper";

import { profile } from "../../screeps-typescript-profiler";

@profile
export class RemoteControl {
  private readonly targetControl: TargetControl;
  public constructor() {
    this.targetControl = TargetControl.getInstance();
  }

  public run(): void {
    for (const roomName in Game.rooms) {
      const roomw = RoomWrapper.getInstance(roomName);

      const importers = _.filter(
        Game.creeps,
        c => c.memory.role === CreepRole.IMPORTER && c.memory.homeRoom === roomw.name
      ).map(c => CreepFactory.getCreep(c));
      const importersByTargetRoom = _.groupBy(importers, c => c.memory.targetRoom);
      for (const targetRoom in importersByTargetRoom) {
        TaskManagement.assignTasks(importersByTargetRoom[targetRoom], this.createHaulTasks(targetRoom));
      }

      if (roomw.controller?.my && roomw.spawns.length > 0) {
        this.requestSpawns(roomw);
      }
    }
  }

  private createHaulTasks(targetRoom: string): HaulTask[] {
    return _.filter(
      Game.creeps,
      creep =>
        creep.memory.haulRequested &&
        !creep.memory.haulerName &&
        creep.memory.targetRoom === targetRoom &&
        creep.memory.role === CreepRole.HARVESTER
    ).map(c => {
      return new HaulTask({
        creepName: c.name,
        targetId: c.id,
        pos: c.pos,
        priority: 200,
        requirements: (hauler: CreepWrapper) => hauler.store.getUsedCapacity() === 0
      });
    });
  }

  private requestSpawns(roomw: RoomWrapper) {
    CreepUtils.log(DEBUG, "remote control: request spawns");
    const spawnQueue = SpawnQueue.getInstance(roomw);

    // IMPORTER
    const remoteHarvestRooms = this.targetControl.remoteHarvestRooms;
    for (const targetRoom of remoteHarvestRooms) {
      const sources = Memory.rooms[targetRoom]?.sources;
      for (const sourceId in sources) {
        const spawningImportersOnSource = SpawnUtils.getSpawnInfoForRoom(
          roomw,
          (spawningCreep: SpawningInfo) =>
            spawningCreep.memory.role === Importer.ROLE && spawningCreep.memory.source === sourceId
        );
        const importersOnSource = _.filter(
          Game.creeps,
          creep => creep.memory.role === Importer.ROLE && creep.memory.source === sourceId
        );
        const carryParts =
          SpawnUtils.countSpawningParts(CARRY, spawningImportersOnSource) +
          CreepUtils.countParts(CARRY, ...importersOnSource);
        const carryPartsNeeded = this.calcCarryPartsNeededForSource(roomw, targetRoom, sources[sourceId].id);
        CreepUtils.consoleLogIfWatched(
          roomw,
          `importer cap: ${sources[sourceId].pos}: ${carryParts}/${carryPartsNeeded}`
        );
        if (carryParts < carryPartsNeeded) {
          spawnQueue.push({
            bodyProfile: CreepBodyUtils.buildBodyProfile(Importer.BODY_PROFILE, carryPartsNeeded, CARRY),
            max: true,
            memory: {
              role: Importer.ROLE,
              targetRoom,
              source: sources[sourceId].id
            },
            priority: 50
          });
        }
      }
    }

    // CLAIMER
    const spawningClaimers = SpawnUtils.getSpawnInfoForRoom(roomw, info => info.memory.role === CreepRole.CLAIMER);
    console.log(JSON.stringify(spawningClaimers));
    const claimers = _.filter(
      Game.creeps,
      c => c.memory.role === CreepRole.CLAIMER && c.memory.homeRoom === roomw.name
    );
    const claimerCount = claimers.length + spawningClaimers.length;
    const remoteTargetRooms = this.targetControl.targetRooms;
    CreepUtils.consoleLogIfWatched(
      roomw,
      `claimers: ${claimers.length}, spawning claimers: ${spawningClaimers.length}`
    );
    CreepUtils.consoleLogIfWatched(
      roomw,
      `remote target rooms: ${remoteTargetRooms.length}, remote harvest rooms: ${remoteHarvestRooms.length}, claimers: ${claimerCount}`
    );
    if (claimerCount < remoteTargetRooms.length + remoteHarvestRooms.length) {
      remoteTargetRooms.forEach(roomName => {
        const claimerOnRoom = claimers.some(c => c.memory.targetRoom === roomName);
        CreepUtils.consoleLogIfWatched(roomw, `claimer on ${roomName}: ${String(claimerOnRoom)}`);
        const roomMemory = Memory.rooms[roomName];
        if (!claimerOnRoom && (roomMemory.controller?.upgradeBlocked ?? 0) - (Game.time - roomMemory.reconTick) < 300) {
          const bodyProfile = { ...Claimer.BODY_PROFILE };
          if (roomMemory.controller?.owner) {
            bodyProfile.maxBodyParts = 50;
          }
          CreepUtils.consoleLogIfWatched(roomw, `pushing claimer to spawn in ${roomw.name} for ${roomName}`);
          spawnQueue.push({
            bodyProfile,
            max: true,
            memory: {
              role: Claimer.ROLE,
              targetRoom: roomName
            },
            priority: 40
          });
        }
      });

      remoteHarvestRooms.forEach(roomName => {
        const claimerOnRoom = claimers.some(c => c.memory.targetRoom === roomName);
        CreepUtils.consoleLogIfWatched(roomw, `claimer on ${roomName}: ${String(claimerOnRoom)}`);
        const roomMemory = Memory.rooms[roomName];
        if (
          !claimerOnRoom &&
          (!roomMemory?.controller?.reservation || roomMemory.controller.reservation?.ticksToEnd < 1000)
        ) {
          spawnQueue.push({
            bodyProfile: Claimer.BODY_PROFILE,
            max: true,
            memory: {
              role: Claimer.ROLE,
              targetRoom: roomName
            },
            priority: 40
          });
        }
      });
    }

    // REMOTE WORKER
    // spawn one remote worker for each claimed room with no spawn
    const noSpawnClaimedRooms = _.filter(
      Game.rooms,
      room => room.controller?.my && room.find(FIND_MY_SPAWNS).length === 0
    );
    const remoteWorkersSpawning = roomw.spawns.filter(
      s => s.spawning && s.memory.spawning?.memory.role === Worker.ROLE && s.memory.spawning.memory.targetRoom
    ).length;
    const remoteWorkers = _.filter(Game.creeps, creep => creep.memory.role === Worker.ROLE && creep.memory.targetRoom);
    if (remoteWorkers.length + remoteWorkersSpawning < noSpawnClaimedRooms.length) {
      const targetRoom = noSpawnClaimedRooms.find(
        room => !remoteWorkers.find(creep => creep.memory.targetRoom === room.name)
      );
      if (targetRoom) {
        spawnQueue.push({
          bodyProfile: Worker.BODY_PROFILE,
          max: true,
          memory: {
            role: Worker.ROLE,
            targetRoom: targetRoom.name
          },
          priority: 40
        });
      }
    }
  }

  private calcCarryPartsNeededForSource(homeRoom: RoomWrapper, targetRoomName: string, sourceId: Id<Source>): number {
    const dropPos = homeRoom.storage?.pos ?? homeRoom.spawns[0].pos;
    const sources = Memory.rooms[targetRoomName].sources;
    const sourcePos = MemoryUtils.unpackRoomPosition(sources[sourceId].pos);
    const path = PathFinder.search(dropPos, { pos: sourcePos, range: 1 });
    const harvestPerTick = SOURCE_ENERGY_CAPACITY / ENERGY_REGEN_TIME;
    const capacityNeeded = harvestPerTick * path.path.length * 2;
    // add an extra part as buffer for travel delays
    const carryPartsNeeded = Math.ceil(capacityNeeded / CARRY_CAPACITY) + 1;

    CreepUtils.consoleLogIfWatched(
      homeRoom,
      `importer calc: roundtrip: ${path.path.length * 2}, parts: ${carryPartsNeeded}, harvest/tick: ${harvestPerTick}`
    );
    return carryPartsNeeded;
  }
}
