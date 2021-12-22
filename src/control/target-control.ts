import { SockPuppetConstants } from "config/sockpuppet-constants";
import { profile } from "../../screeps-typescript-profiler";

@profile
export class TargetControl {
  /**
   * Remote harvest rooms
   */

  public static get remoteHarvestRooms(): string[] {
    const roomNames = _.filter(Game.flags, flag => flag.color === SockPuppetConstants.FLAG_COLOR_REMOTE).map(
      flag => flag.pos.roomName
    );
    return roomNames.filter(name => TargetControl.isValidRemote(name));
  }

  private static isValidRemote(roomName: string): boolean {
    return this.isNotOwned(roomName) && this.isNotReservedByOthers(roomName);
  }

  /**
   * Target rooms
   */

  public static get targetRooms(): string[] {
    const roomNames = _.filter(Game.flags, flag => flag.color === SockPuppetConstants.FLAG_COLOR_TARGET).map(
      flag => flag.pos.roomName
    );
    return roomNames.filter(name => TargetControl.isValidTarget(name));
  }

  private static isValidTarget(roomName: string): boolean {
    return this.isNotOwnedByMe(roomName);
  }

  /**
   * Attack rooms
   */

  public static get attackRooms(): string[] {
    const roomNames = _.filter(Game.flags, flag => flag.color === SockPuppetConstants.FLAG_COLOR_ATTACK).map(
      flag => flag.pos.roomName
    );
    const validAttackRooms = roomNames.filter(name => TargetControl.isValidAttack(name));
    console.log(`DEBUG: valid attack rooms ${JSON.stringify(validAttackRooms)}`);
    return validAttackRooms;
  }

  private static isValidAttack(roomName: string): boolean {
    return this.isNotOwnedByMe(roomName) && this.isNotReservedByMe(roomName);
  }

  /**
   * Validator functions
   */

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

  /**
   * Utility functions
   */

  public static calcRoomDistance(roomArgA: Room | string, roomArgB: Room | string): number {
    const roomNameA = roomArgA instanceof Room ? roomArgA.name : roomArgA;
    const roomNameB = roomArgB instanceof Room ? roomArgB.name : roomArgB;
    const roomNameASplit = roomNameA.split(/(\w)/);
    const posAx = (roomNameASplit[0] === "W" ? 1 : -1) * Number(roomNameASplit[1]);
    const posAy = (roomNameASplit[2] === "N" ? 1 : -1) * Number(roomNameASplit[3]);
    const roomNameBSplit = roomNameB.split(/(\w)/);
    const posBx = (roomNameBSplit[0] === "W" ? 1 : -1) * Number(roomNameBSplit[1]);
    const posBy = (roomNameBSplit[2] === "N" ? 1 : -1) * Number(roomNameBSplit[3]);
    return Math.sqrt(Math.pow(posAx - posBx, 2) + Math.pow(posAy - posBy, 2));
  }
}
