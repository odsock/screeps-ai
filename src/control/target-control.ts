import { SockPuppetConstants } from "config/sockpuppet-constants";
import { profile } from "../../screeps-typescript-profiler";

export const enum RoomType {
  TARGET,
  REMOTE_HARVEST,
  ATTACK,
  CLAIMED,
  FORBIDDEN,
  UNKNOWN
}

@profile
export class TargetControl {
  private static instance: TargetControl | undefined;
  public static getInstance(): TargetControl {
    this.instance = this.instance ?? new TargetControl();
    return this.instance;
  }

  public getRoomType(room: Room | string): RoomType {
    if (this.isForbiddenRoom(room)) {
      return RoomType.FORBIDDEN;
    } else if (this.isTargetRoom(room)) {
      return RoomType.TARGET;
    } else if (this.isRemoteHarvestRoom(room)) {
      return RoomType.REMOTE_HARVEST;
    } else if (this.isAttackRoom(room)) {
      return RoomType.ATTACK;
    } else if (this.isClaimedRoom(room)) {
      return RoomType.TARGET;
    } else {
      return RoomType.UNKNOWN;
    }
  }

  public get scoutRooms(): string[] {
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
  public get forbiddenRooms(): string[] {
    return _.filter(Game.flags, flag => flag.color === SockPuppetConstants.FLAG_COLOR_FORBIDDEN).map(
      flag => flag.pos.roomName
    );
  }

  public isForbiddenRoom(room: Room | string): boolean {
    const roomName = room instanceof Room ? room.name : room;
    return this.forbiddenRooms.includes(roomName);
  }

  /**
   * Claimed rooms
   */
  public get claimedRooms(): string[] {
    return _.filter(Game.rooms, room => room.controller?.my).map(room => room.name);
  }

  public isClaimedRoom(roomArg: Room | string): boolean {
    const room = roomArg instanceof Room ? roomArg : Game.rooms[roomArg];
    return room?.controller?.my ?? false;
  }

  /**
   * Remote harvest rooms
   */

  public get remoteHarvestRooms(): string[] {
    return _.filter(Game.flags, flag => flag.color === SockPuppetConstants.FLAG_COLOR_REMOTE)
      .map(flag => flag.pos.roomName)
      .filter(name => this.isValidRemote(name));
  }

  private isValidRemote(roomName: string): boolean {
    return this.isNotOwned(roomName) && this.isNotReservedByOthers(roomName);
  }

  public isRemoteHarvestRoom(room: Room | string): boolean {
    const roomName = room instanceof Room ? room.name : room;
    return this.remoteHarvestRooms.includes(roomName);
  }

  /**
   * Target rooms
   */

  public get targetRooms(): string[] {
    return _.filter(Game.flags, flag => flag.color === SockPuppetConstants.FLAG_COLOR_TARGET)
      .map(flag => flag.pos.roomName)
      .filter(name => this.isValidTarget(name));
  }

  private isValidTarget(roomName: string): boolean {
    return this.isNotOwnedByMe(roomName);
  }

  public isTargetRoom(room: Room | string): boolean {
    const roomName = room instanceof Room ? room.name : room;
    return this.targetRooms.includes(roomName);
  }

  /**
   * Attack rooms
   */

  public get attackRooms(): string[] {
    const validAttackRooms = _.filter(Game.flags, flag => flag.color === SockPuppetConstants.FLAG_COLOR_ATTACK).map(
      flag => flag.pos.roomName
    );
    return validAttackRooms;
  }

  public isAttackRoom(room: Room | string): boolean {
    const roomName = room instanceof Room ? room.name : room;
    return this.attackRooms.includes(roomName);
  }

  /**
   * Validator functions
   */

  private isNotOwned(roomName: string): boolean {
    const roomMemory = Memory.rooms[roomName];
    return !roomMemory.controller?.owner;
  }

  private isNotReservedByMe(roomName: string): boolean {
    const roomMemory = Memory.rooms[roomName];
    return roomMemory.controller?.reservation?.username !== Memory.username;
  }

  private isNotReservedByOthers(roomName: string): boolean {
    const roomMemory = Memory.rooms[roomName];
    return (
      !roomMemory.controller?.reservation ||
      roomMemory.controller.reservation.username === Memory.username ||
      roomMemory.controller.reservation.username === "Invader"
    );
  }

  private isNotOwnedByMe(roomName: string): boolean {
    const roomMemory = Memory.rooms[roomName];
    return roomMemory.controller.owner?.username !== Memory.username;
  }
}
