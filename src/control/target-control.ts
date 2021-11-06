import { TargetConfig } from "config/target-config";
import { profile } from "../../screeps-typescript-profiler";

@profile
export class TargetControl {
  public static isTargetRoom(roomName: string): boolean {
    return (TargetConfig.TARGETS[Game.shard.name] ?? []).includes(roomName);
  }

  public static isRemoteHarvestRoom(roomName: string): boolean {
    return (TargetConfig.REMOTE_HARVEST[Game.shard.name] ?? []).includes(roomName);
  }
}
