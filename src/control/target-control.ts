import { profile } from "../../screeps-typescript-profiler";

@profile
export class TargetControl {
  public static get remoteHarvestRooms(): string[] {
    const roomNames = _.filter(Game.flags, flag => flag.color === COLOR_YELLOW).map(flag => flag.pos.roomName);
    return roomNames.filter(name => TargetControl.isValidRemote(name));
  }

  private static isValidRemote(roomName: string): boolean {
    return this.isNotOwned(roomName) && this.isNotReservedByOthers(roomName);
  }

  public static get targetRooms(): string[] {
    const roomNames = _.filter(Game.flags, flag => flag.color === COLOR_GREEN).map(flag => flag.pos.roomName);
    return roomNames.filter(name => TargetControl.isValidTarget(name));
  }

  private static isValidTarget(roomName: string): boolean {
    return this.isNotOwnedByMe(roomName);
  }

  public static get cleanRooms(): string[] {
    const roomNames = _.filter(Game.flags, flag => flag.color === COLOR_RED).map(flag => flag.pos.roomName);
    const validCleanRooms = roomNames.filter(name => TargetControl.isValidClean(name));
    console.log(`DEBUG: valid clean rooms ${JSON.stringify(validCleanRooms)}`);
    return validCleanRooms;
  }

  private static isValidClean(roomName: string): boolean {
    return this.isNotOwnedByMe(roomName) && this.isNotReservedByMe(roomName);
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
