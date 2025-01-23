import { SockPuppetConstants } from "config/sockpuppet-constants";
import { MemoryUtils } from "./memory-utils";

export enum StatType {
  HARVEST_ENERGY_STAT = "HARVEST_ENERGY_STAT",
  UPGRADE_STAT = "UPGRADE_STAT",
  REPAIR_STAT = "REPAIR_STAT",
  BUILD_STAT = "BUILD_STAT",
  SPAWN_STAT = "SPAWN_STAT"
}

import { profile } from "../../screeps-typescript-profiler";

@profile
export class Stats {
  private readonly STATS_ROOMS_KEY = "STATS_ROOMS";

  public record(roomName: string, type: StatType, value: number): void {
    const key = `${StatType[type]}_${roomName}`;
    const previousValue: number = MemoryUtils.getCache(key) ?? 0;
    MemoryUtils.setCache(key, previousValue + value, -1);
    this.updateStatsRooms(roomName);
  }

  private updateStatsRooms(roomName: string) {
    const statsRooms: string[] = MemoryUtils.getCache(this.STATS_ROOMS_KEY) ?? [];
    if (!statsRooms.includes(roomName)) {
      statsRooms.push(roomName);
    }
    MemoryUtils.setCache(this.STATS_ROOMS_KEY, statsRooms, -1);
  }

  public showStats(): void {
    const startTick: number = MemoryUtils.getCache(SockPuppetConstants.START_TICK) ?? Game.time;
    const statsPeriod = Game.time - startTick;

    const statsRooms: string[] = MemoryUtils.getCache(this.STATS_ROOMS_KEY) ?? [];
    statsRooms.forEach(roomName => {
      const stats: Record<string, number> = this.getEnergyStats(roomName);
      const efficiency = this.calcEnergyEfficiency(stats);

      console.log(
        `${roomName}:  efficiency ${(efficiency * 100).toFixed(2)}% over last ${statsPeriod} ticks - ` +
          Object.entries(stats)
            .map(([key, value]) => `${key}: ${value}`)
            .join(", ")
      );
    });

    const cpuAverage = Stats.calcCpuAverage(statsPeriod);
    console.log(`CPU ${Game.cpu.getUsed()} - ${cpuAverage.toFixed(4)} over last ${statsPeriod} ticks`);
  }

  private calcEnergyEfficiency(stats: Record<string, number>) {
    const energySpent = stats[StatType.BUILD_STAT] + stats[StatType.UPGRADE_STAT] + stats[StatType.REPAIR_STAT];
    const efficiency = energySpent / stats[StatType.HARVEST_ENERGY_STAT];
    return efficiency;
  }

  private getEnergyStats(roomName: string) {
    const stats: Record<string, number> = {};
    for (const key in StatType) {
      stats[key] = MemoryUtils.getCache(`${key}_${roomName}`) ?? 0;
    }
    return stats;
  }

  private static calcCpuAverage(statsPeriod: number): number {
    let cpuTotal: number = MemoryUtils.getCache(SockPuppetConstants.CPU_TOTAL) ?? 0;
    cpuTotal = Game.cpu.getUsed() + cpuTotal;
    MemoryUtils.setCache(SockPuppetConstants.CPU_TOTAL, cpuTotal, -1);
    return cpuTotal / statsPeriod;
  }
}
