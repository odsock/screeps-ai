import { TargetConfig } from "config/target-config";
import { CreepUtils } from "creep-utils";
import { MemoryUtils } from "planning/memory-utils";
import { SpawnQueue } from "planning/spawn-queue";
import { Claimer } from "roles/claimer";
import { Importer } from "roles/importer";
import { Worker } from "roles/worker";
import { RoomWrapper } from "structures/room-wrapper";
import { SpawnUtils } from "./spawn-utils";

export class RemoteControl {
  public run(): void {
    for (const roomName in Game.rooms) {
      const roomw = RoomWrapper.getInstance(roomName);

      if (roomw.controller?.my && roomw.spawns.length > 0) {
        this.requestSpawns(roomw);
      }
    }
  }

  private requestSpawns(roomw: RoomWrapper) {
    const spawnQueue = SpawnQueue.getInstance(roomw);

    // IMPORTER
    const remoteHarvestRooms =
      TargetConfig.REMOTE_HARVEST[Game.shard.name]?.filter(name => this.isValidRemote(name)) ?? [];
    console.log(`DEBUG: valid remotes: ${remoteHarvestRooms.length}`);
    for (const targetRoom of remoteHarvestRooms) {
      const sources = Memory.rooms[targetRoom].sources;
      console.log(`DEBUG: sources ${JSON.stringify(sources)}`);
      for (const sourceId in sources) {
        console.log(`DEBUG: source ${sourceId}`);
        const spawningImportersOnSource = SpawnUtils.getSpawnInfoFor(
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
            bodyProfile: SpawnUtils.buildBodyProfile(Importer.BODY_PROFILE, carryPartsNeeded, CARRY),
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
    const claimerCount = SpawnUtils.getCreepCountForRole(roomw, Claimer.ROLE);
    const maxClaimers = this.getMaxClaimerCount();
    if (claimerCount < maxClaimers) {
      const remoteTargetRooms = TargetConfig.TARGETS[Game.shard.name].filter(name => {
        return !Game.rooms[name]?.controller?.my;
      });
      for (const roomName of [...remoteTargetRooms, ...remoteHarvestRooms]) {
        const claimerOnRoom = !!_.filter(
          Game.creeps,
          creep => creep.memory.role === Claimer.ROLE && creep.memory.targetRoom === roomName
        ).length;
        CreepUtils.consoleLogIfWatched(roomw, `claimer for ${roomName}: ${String(claimerOnRoom)}`);
        if (!claimerOnRoom) {
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
      }
    }

    // REMOTE WORKER
    // spawn one remote worker for each claimed room with no spawn
    const noSpawnClaimedRooms = _.filter(
      Game.rooms,
      room =>
        room.controller?.owner &&
        room.controller?.owner.username === roomw.controller?.owner?.username &&
        room.find(FIND_MY_SPAWNS).length === 0
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

  /**
   * Validate remote harvest room
   * Valid remotes are not owned (by me or anyone), and not reserved by other players
   */
  private isValidRemote(roomName: string): boolean {
    const roomMemory = Memory.rooms[roomName];
    if (
      !roomMemory.controller?.owner &&
      (!roomMemory.controller?.reservation ||
        roomMemory.controller.reservation.username === _.toArray(Game.spawns)[0]?.owner.username)
    ) {
      return true;
    }
    return false;
  }

  private getMaxClaimerCount(): number {
    const targetedRooms = TargetConfig.TARGETS[Game.shard.name] ?? [];
    const remoteHarvestRooms = TargetConfig.REMOTE_HARVEST[Game.shard.name] ?? [];
    const targetRoomNames = targetedRooms.concat(remoteHarvestRooms);
    if (targetRoomNames) {
      return targetRoomNames.filter(roomName => {
        // validate room name
        try {
          new RoomPosition(0, 0, roomName);
          // can't do this without a creep in the room
        } catch (error) {
          console.log(`ERROR: bad target config: ${roomName}`);
          return false;
        }
        // don't spawn claimers for rooms we own
        if (Game.rooms[roomName]?.controller?.my) {
          return false;
        }
        return true;
      }).length;
    }
    return 0;
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
