import { SockPuppetConstants } from "config/sockpuppet-constants";
import { profile } from "../../screeps-typescript-profiler";

@profile
export class TargetControl {
  public static get scoutRooms(): string[] {
    const flaggedRooms = _.filter(Game.flags, flag => flag.color === SockPuppetConstants.FLAG_COLOR_SCOUT).map(
      flag => flag.pos.roomName
    );
    return [
      ...flaggedRooms,
      ...this.targetRooms,
      ...this.remoteHarvestRooms,
      ...this.attackRooms,
      ...this.claimedRooms
    ];
  }

  /**
   * Forbidden rooms
   */
  public static get forbiddenRooms(): string[] {
    return _.filter(Game.flags, flag => flag.color === SockPuppetConstants.FLAG_COLOR_FORBIDDEN).map(
      flag => flag.pos.roomName
    );
  }

  public static isForbidden(room: Room | string): boolean {
    const roomName = room instanceof Room ? room.name : room;
    return this.forbiddenRooms.includes(roomName);
  }

  /**
   * Claimed rooms
   */
  public static get claimedRooms(): string[] {
    return _.filter(Game.rooms, room => room.controller?.my).map(room => room.name);
  }

  /**
   * Remote harvest rooms
   */

  public static get remoteHarvestRooms(): string[] {
    return _.filter(Game.flags, flag => flag.color === SockPuppetConstants.FLAG_COLOR_REMOTE)
      .map(flag => flag.pos.roomName)
      .filter(name => TargetControl.isValidRemote(name));
  }

  private static isValidRemote(roomName: string): boolean {
    return this.isNotOwned(roomName) && this.isNotReservedByOthers(roomName);
  }

  /**
   * Target rooms
   */

  public static get targetRooms(): string[] {
    return _.filter(Game.flags, flag => flag.color === SockPuppetConstants.FLAG_COLOR_TARGET)
      .map(flag => flag.pos.roomName)
      .filter(name => TargetControl.isValidTarget(name));
  }

  private static isValidTarget(roomName: string): boolean {
    return this.isNotOwnedByMe(roomName);
  }

  /**
   * Attack rooms
   */

  public static get attackRooms(): string[] {
    const validAttackRooms = _.filter(Game.flags, flag => flag.color === SockPuppetConstants.FLAG_COLOR_ATTACK)
      .map(flag => flag.pos.roomName)
      .filter(name => TargetControl.isValidAttack(name));
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
    return (
      !roomMemory.controller?.reservation ||
      roomMemory.controller.reservation.username === Memory.username ||
      roomMemory.controller.reservation.username === SYSTEM_USERNAME
    );
  }

  private static isNotOwnedByMe(roomName: string): boolean {
    const roomMemory = Memory.rooms[roomName];
    return roomMemory.controller.owner?.username !== Memory.username;
  }
}
