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
    const remoteHarvestRooms = TargetConfig.REMOTE_HARVEST[Game.shard.name] ?? [];
    const remoteHarvestRoomsMy =
      remoteHarvestRooms.filter(name => {
        return !Game.rooms[name]?.controller?.my;
      }) ?? [];
    for (const targetRoom of remoteHarvestRoomsMy) {
      const importersNeeded = this.calcImportersNeededForRoom(roomw, targetRoom);
      const importersSpawningForRoom = SpawnUtils.getSpawningCountForTarget(roomw, Importer.ROLE, targetRoom);
      const importersOnRoom =
        _.filter(Game.creeps, creep => creep.memory.role === Importer.ROLE && creep.memory.targetRoom === targetRoom)
          .length + importersSpawningForRoom;
      CreepUtils.consoleLogIfWatched(roomw, `importers for ${targetRoom}: ${importersOnRoom}/${importersNeeded}`);
      if (importersNeeded > importersOnRoom) {
        spawnQueue.push({
          bodyProfile: Importer.BODY_PROFILE,
          max: true,
          memory: {
            role: Importer.ROLE,
            targetRoom
          },
          priority: 50
        });
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

  private calcImportersNeededForRoom(roomw: RoomWrapper, targetRoom: string): number {
    // return cached value if room capacity hasn't changed
    const remoteHarvestRoomMemory = roomw.memory.remoteHarvest?.[targetRoom];
    if (remoteHarvestRoomMemory?.spawnCapacity === roomw.energyCapacityAvailable) {
      return remoteHarvestRoomMemory.importersNeeded;
    }

    // use importer as scout if no recon for room
    const roomMemory = Memory.rooms[targetRoom];
    if (!roomMemory) {
      return 1;
    }
    // don't spawn importers for owned rooms, or reserved by other players
    if (
      roomMemory.controller?.owner ||
      roomMemory.controller?.reservation?.username !== roomw.controller?.owner?.username
    ) {
      return 0;
    }

    // spawn enough importers at current max size to maximize harvest
    const importerBody = SpawnUtils.getMaxBody(Importer.BODY_PROFILE, roomw);
    const energyCapacity = importerBody.filter(part => part === CARRY).length * CARRY_CAPACITY;

    const dropPos = roomw.storage?.pos ?? roomw.spawns[0].pos;
    const sources = Memory.rooms[targetRoom].sources;
    let importersNeeded = 0;
    for (const sourceId in sources) {
      const sourcePos = MemoryUtils.unpackRoomPosition(sources[sourceId].pos);
      const path = PathFinder.search(dropPos, { pos: sourcePos, range: 1 });
      const transportPerTick = energyCapacity / (path.path.length * 2);
      const harvestPerTick = SOURCE_ENERGY_CAPACITY / ENERGY_REGEN_TIME;
      CreepUtils.consoleLogIfWatched(
        roomw,
        `importer calc: roundtrip: ${
          path.path.length * 2
        }, transport/tick: ${transportPerTick}, harvest/tick: ${harvestPerTick}`
      );
      importersNeeded += harvestPerTick / transportPerTick;
    }
    // cache result in memory
    const remoteHarvestRoom = { importersNeeded, spawnCapacity: roomw.energyCapacityAvailable };
    roomw.memory.remoteHarvest = roomw.memory.remoteHarvest ?? {};
    roomw.memory.remoteHarvest[targetRoom] = remoteHarvestRoom;
    return importersNeeded;
  }
}
