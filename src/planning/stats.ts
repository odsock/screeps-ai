import { SockPuppetConstants } from "config/sockpuppet-constants";
import { MemoryUtils } from "./memory-utils";

export enum StatType {
  HARVEST_ENERGY_STAT,
  UPGRADE_STAT
}

export class Stats {
  public static record(type: StatType, value: number): void {
    const key = type.toString();
    console.log(type);
    console.log(key);
    const previousValue = MemoryUtils.getCache(key);
    console.log(previousValue);
    MemoryUtils.setCache(key, previousValue ?? 0 + value, -1);
  }

  public static showStats(): void {
    const startTick = MemoryUtils.getCache(SockPuppetConstants.START_TICK);
    console.log(`start tick: ${String(startTick)}`);
    for (const key in StatType) {
      const stats = MemoryUtils.getCache(key);
      console.log(`${key}: ${String(stats)}`);
    }
  }
}
