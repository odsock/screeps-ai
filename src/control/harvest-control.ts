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
    const harvesters = roomw.find(FIND_MY_CREEPS, { filter: c => (c.memory.role = Harvester.ROLE) });

    for (const sourceId in roomw.memory.sources) {
      const source = Game.getObjectById(sourceId as Id<Source>);
      if (!source) {
        Game.notify(`ERROR: removed bad source id ${sourceId} in room ${roomw.name}`);
        delete roomw.memory.sources[sourceId];
        continue;
      }

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

      // replace aging harvester if at or below needed level
      if (creepCount <= positionsForSource && partCount <= partsNeeded) {
        SpawnUtils.requestReplacementCreep(roomw, Harvester);
      }
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
