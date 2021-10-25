import { CreepUtils } from "creep-utils";
import { SpawnQueue } from "planning/spawn-queue";
import { Harvester } from "roles/harvester";
import { RoomWrapper } from "structures/room-wrapper";
import { profile } from "../../screeps-typescript-profiler";
import { SpawnUtils } from "./spawn-utils";

@profile
export class HarvestControl {
  public run(): void {
    for (const roomName in Game.rooms) {
      const roomw = RoomWrapper.getInstance(roomName);

      if (roomw.controller?.my && roomw.spawns.length > 0) {
        this.requestSpawns(roomw);
      }
    }
  }

  /**
   * manage harvester population
   * should have enough to drain sources at regen time, and fit in harvest positions
   * */
  private requestSpawns(roomw: RoomWrapper) {
    const spawnQueue = SpawnQueue.getInstance(roomw);
    const harvesters = roomw.find(FIND_MY_CREEPS, { filter: c => c.memory.role === Harvester.ROLE });

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
        SpawnUtils.getSpawningPartCount(spawningHarvestersOnSource, WORK);
      const positionsForSource = roomw.memory.sources[sourceId].harvestPositions.length;
      const partsNeeded = source.energyCapacity / ENERGY_REGEN_TIME / HARVEST_POWER;
      CreepUtils.consoleLogIfWatched(
        roomw,
        `harvesters: ${creepCount}/${positionsForSource} positions, ${partCount}/${partsNeeded} parts`
      );
      if (creepCount < positionsForSource && partCount < partsNeeded) {
        CreepUtils.consoleLogIfWatched(roomw, `spawning ${Harvester.ROLE}`);
        spawnQueue.push({
          bodyProfile: Harvester.BODY_PROFILE,
          max: true,
          memory: {
            role: Harvester.ROLE,
            source: sourceId as Id<Source>
          },
          priority: 90
        });
      }

      // replace harvester older than spawn time if at or below needed level
      if (creepCount <= positionsForSource && partCount <= partsNeeded) {
        const ticksToSpawn = SpawnUtils.calcSpawnTime(Harvester.BODY_PROFILE, roomw);
        const oldestCreep = this.findOldestCreep(activeHarvestersOnSource.filter(creep => !creep.memory.retiring));
        if (oldestCreep?.ticksToLive && oldestCreep.ticksToLive <= ticksToSpawn) {
          CreepUtils.consoleLogIfWatched(roomw, `spawning replacement ${Harvester.ROLE}`);
          spawnQueue.push({
            bodyProfile: Harvester.BODY_PROFILE,
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

  private findOldestCreep(creeps: Creep[]) {
    return creeps.reduce((oldest: Creep | undefined, c) => {
      if (!oldest || (c.ticksToLive && oldest.ticksToLive && c.ticksToLive < oldest.ticksToLive)) {
        return c;
      }
      return oldest;
    }, undefined);
  }

  private replaceOldCreep() {
    if (oldestCreep?.ticksToLive && oldestCreep.ticksToLive <= ticksToReplace) {
      CreepUtils.consoleLogIfWatched(roomw, `spawning replacement ${type.ROLE}`);
      SpawnQueue.getInstance(roomw).push({
        bodyProfile: type.BODY_PROFILE,
        max: true,
        memory: {
          role: type.ROLE,
          replacing: oldestCreep.name
        },
        priority: 80
      });
    }
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
}
