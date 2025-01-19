import { SockPuppetConstants } from "config/sockpuppet-constants";
import { MemoryUtils } from "./memory-utils";

export enum StatType {
  HARVEST_ENERGY_STAT = "HARVEST_ENERGY_STAT",
  UPGRADE_STAT = "UPGRADE_STAT",
  REPAIR_STAT = "REPAIR_STAT",
  BUILD_STAT = "BUILD_STAT"
}

export class Stats {
  public static record(type: StatType, value: number): void {
    const key = StatType[type];
    const previousValue: number = MemoryUtils.getCache(key) ?? 0;
    MemoryUtils.setCache(key, previousValue + value, -1);
  }

  public static showStats(): void {
    const startTick: number = MemoryUtils.getCache(SockPuppetConstants.START_TICK) ?? Game.time;
    const statsPeriod = Game.time - startTick;

    const efficiency = Stats.calcEnergyEfficiency();
    const cpuAverage = Stats.calcCpuAverage(statsPeriod);
    console.log(
      `efficiency ${(efficiency * 100).toFixed(2)}% CPU ${cpuAverage.toFixed(4)} over last ${statsPeriod} ticks`
    );
  }

  private static calcEnergyEfficiency() {
    const stats: Record<string, number> = {};
    for (const key in StatType) {
      stats[key] = MemoryUtils.getCache(key) ?? 0;
    }

    console.log(
      Object.entries(stats)
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ")
    );
    const energySpent = stats[StatType.BUILD_STAT] + stats[StatType.UPGRADE_STAT];
    const efficiency = energySpent / stats[StatType.HARVEST_ENERGY_STAT];
    return efficiency;
  }

  private static calcCpuAverage(statsPeriod: number): number {
    let cpuTotal: number = MemoryUtils.getCache(SockPuppetConstants.CPU_TOTAL) ?? 0;
    cpuTotal = Game.cpu.getUsed() + cpuTotal;
    MemoryUtils.setCache(SockPuppetConstants.CPU_TOTAL, cpuTotal, -1);
    return cpuTotal / statsPeriod;
  }
}
