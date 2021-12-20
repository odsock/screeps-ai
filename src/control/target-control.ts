import { TargetConfig } from "config/target-config";
import { profile } from "../../screeps-typescript-profiler";

@profile
export class TargetControl {
  private static validRemoteHarvestRooms: string[];
  private static validTargetRooms: string[];

  public static get remoteHarvestRooms(): string[] {
    if (this.validRemoteHarvestRooms) {
      return this.validRemoteHarvestRooms;
    }
    const roomNames = TargetConfig.REMOTE_HARVEST[Game.shard.name] ?? [];
    this.validRemoteHarvestRooms = roomNames.filter(name => TargetControl.isValidRemote(name));
    return this.validRemoteHarvestRooms;
  }

  public static get targetRooms(): string[] {
    if (this.validTargetRooms) {
      return this.validTargetRooms;
    }
    const roomNames = TargetConfig.TARGETS[Game.shard.name] ?? [];
    this.validTargetRooms = roomNames.filter(name => TargetControl.isValidTarget(name));
    return this.validTargetRooms;
  }

  public static isTargetRoom(roomName: string): boolean {
    return (TargetConfig.TARGETS[Game.shard.name] ?? []).includes(roomName);
  }

  public static isRemoteHarvestRoom(roomName: string): boolean {
    return (TargetConfig.REMOTE_HARVEST[Game.shard.name] ?? []).includes(roomName);
  }

  /**
   * Validate remote harvest room
   * Valid remotes are not owned (by me or anyone), and not reserved by other players
   */
  private static isValidRemote(roomName: string): boolean {
    const roomMemory = Memory.rooms[roomName];
    if (
      !roomMemory.controller?.owner &&
      (!roomMemory.controller?.reservation || roomMemory.controller.reservation.username === Memory.username)
    ) {
      return true;
    }
    return false;
  }

  /**
   * Validate target room
   * Valid targets are not owned by me
   */
  private static isValidTarget(roomName: string): boolean {
    const roomMemory = Memory.rooms[roomName];
    if (roomMemory.controller.owner?.username !== Memory.username) {
      return true;
    }
    return false;
  }
}
