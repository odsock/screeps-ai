import { profile } from "../../screeps-typescript-profiler";

@profile
export class TargetControl {
  private static validRemoteHarvestRooms: string[];
  private static validTargetRooms: string[];
  private static validCleanRooms: string[];

  public static get remoteHarvestRooms(): string[] {
    if (this.validRemoteHarvestRooms) {
      return this.validRemoteHarvestRooms;
    }
    const roomNames = _.filter(Game.flags, flag => flag.color === COLOR_YELLOW).map(flag => flag.pos.roomName);
    this.validRemoteHarvestRooms = roomNames.filter(name => TargetControl.isValidRemote(name));
    return this.validRemoteHarvestRooms;
  }

  private static isValidRemote(roomName: string): boolean {
    return this.isNotOwned(roomName) && this.isNotReservedByOthers(roomName);
  }

  public static get targetRooms(): string[] {
    if (this.validTargetRooms) {
      return this.validTargetRooms;
    }
    const roomNames = _.filter(Game.flags, flag => flag.color === COLOR_GREEN).map(flag => flag.pos.roomName);
    this.validTargetRooms = roomNames.filter(name => TargetControl.isValidTarget(name));
    return this.validTargetRooms;
  }

  private static isValidTarget(roomName: string): boolean {
    return this.isNotOwnedByMe(roomName);
  }

  public static get cleanRooms(): string[] {
    if (this.validCleanRooms) {
      console.log(`DEBUG: found cached clean rooms list: ${JSON.stringify(this.validCleanRooms)}`);
      return this.validCleanRooms;
    }
    const roomNames = _.filter(Game.flags, flag => flag.color === COLOR_RED).map(flag => flag.pos.roomName);
    this.validCleanRooms = roomNames.filter(name => TargetControl.isValidClean(name));
    console.log(`DEBUG: valid clean rooms ${JSON.stringify(this.validCleanRooms)}`);
    return this.validCleanRooms;
  }

  private static isValidClean(roomName: string): boolean {
    return !this.isNotOwnedByMe(roomName) && !this.isNotReservedByMe(roomName);
  }

  private static isNotOwned(roomName: string): boolean {
    const roomMemory = Memory.rooms[roomName];
    return !roomMemory.controller?.owner;
  }

  private static isNotReservedByMe(roomName: string): boolean {
    const roomMemory = Memory.rooms[roomName];
    return roomMemory.controller?.reservation?.username !== Memory.username;
  }

  private static isNotReservedByOthers(roomName: string): boolean {
    const roomMemory = Memory.rooms[roomName];
    return !roomMemory.controller?.reservation || roomMemory.controller.reservation.username === Memory.username;
  }

  private static isNotOwnedByMe(roomName: string): boolean {
    const roomMemory = Memory.rooms[roomName];
    return roomMemory.controller.owner?.username !== Memory.username;
  }
}
