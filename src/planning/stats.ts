import { SockPuppetConstants } from "config/sockpuppet-constants";
import { MemoryUtils } from "./memory-utils";
import { stat } from "fs";

export enum StatType {
  HARVEST_ENERGY_STAT = "HARVEST_ENERGY_STAT",
  UPGRADE_STAT = "UPGRADE_STAT",
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

    const stats: Record<string, number> = {};
    for (const key in StatType) {
      stats[key] = MemoryUtils.getCache(key) ?? 0;
      console.log(`${key}: ${String(stats[key])}`);
    }

    const energySpent = stats[StatType.BUILD_STAT] + stats[StatType.UPGRADE_STAT];
    const efficiency = energySpent / stats[StatType.HARVEST_ENERGY_STAT];
    console.log(`efficiency ${(efficiency * 100).toFixed(2)}% over last ${statsPeriod} ticks`);
  }
}
