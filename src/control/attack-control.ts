import { CreepRole } from "config/creep-types";
import { SpawnQueue } from "planning/spawn-queue";
import { Raider } from "roles/raider";
import { TravelUtils } from "utils/travel-utils";
import { SpawnUtils } from "./spawn-utils";
import { TargetControl } from "./target-control";
import { CreepUtils, LogLevel } from "creep-utils";

declare global {
  interface FlagMemory {
    rallyRoom?: string;
    raidSent?: boolean;
    tactic?: string;
  }
}

import { profile } from "../../screeps-typescript-profiler";

@profile
export class AttackControl {
  private readonly targetControl: TargetControl;
  private readonly travelUtils: TravelUtils;
  public constructor() {
    this.targetControl = TargetControl.getInstance();
    this.travelUtils = TravelUtils.getInstance();
  }

  public run(): void {
    const raiders = _.filter(Game.creeps, c => c.memory.role === CreepRole.RAIDER);
    const freeRaiders = raiders.filter(raider => !this.roomNeedsAttack(raider.memory.targetRoom));

    // assign or spawn a raider for each unclean attack room
    for (const attackFlag of this.targetControl.attackFlags) {
      const roomName = attackFlag.pos.roomName;
      if (!this.roomNeedsAttack(roomName)) {
        CreepUtils.log(LogLevel.DEBUG, `${roomName}: attack: not needed`);
        continue;
      }

      // increase raiding party size if previous raid failed
      // secondary flag color constant is proxy for raiding party size
      const raidersAssignedCount = this.getRaidersAssignedCount(raiders, roomName);
      if (attackFlag.memory.raidSent && raidersAssignedCount === 0) {
        this.increaseRaidSize(attackFlag);
      }
      const raidSize = this.getRaidSize(attackFlag);
      this.setRallyRoom(attackFlag);
      const spawningRaidersCount = this.getSpawningRaidersCount(roomName);
      let raidersStillNeeded = raidSize - raidersAssignedCount - spawningRaidersCount;
      CreepUtils.log(
        LogLevel.DEBUG,
        `${roomName}: attack: raiders still needed: ${raidersStillNeeded}`
      );
      if (raidersStillNeeded > 0 && freeRaiders.length > 0) {
        // TODO assign closest raider
        const reassignSlice = freeRaiders.splice(0, raidersStillNeeded);
        reassignSlice.forEach(creep => (creep.memory.targetRoom = roomName));
        raidersStillNeeded -= reassignSlice.length;
        if (raidersStillNeeded > 0) {
          this.queueSpawn(roomName, raidersStillNeeded, attackFlag.name);
        }
      }
    }
  }

  private setRallyRoom(attackFlag: Flag): void {
    const rallyRoom =
      attackFlag.memory.rallyRoom ??
      this.travelUtils.findClosestRoom(
        attackFlag.pos.roomName,
        this.targetControl.claimedRooms.concat(this.targetControl.remoteHarvestRooms)
      );
    attackFlag.memory.rallyRoom = rallyRoom;
    if (!rallyRoom) {
      CreepUtils.log(LogLevel.ERROR, `ERROR: no rally room found for ${attackFlag.pos.roomName}`);
    }
  }

  private getSpawningRaidersCount(roomName: string): number {
    return SpawnUtils.getSpawnInfo(
      info => info.memory.role === CreepRole.RAIDER && info.memory.targetRoom === roomName
    ).length;
  }

  private getRaidSize(attackFlag: Flag): number {
    return attackFlag.secondaryColor.valueOf() ?? 0;
  }

  private getRaidersAssignedCount(raiders: Creep[], roomName: string): number {
    return raiders.filter(raider => raider.memory.targetRoom === roomName).length;
  }

  private increaseRaidSize(attackFlag: Flag): void {
    if (attackFlag.secondaryColor < 10) {
      attackFlag.secondaryColor += 1;
    }
    attackFlag.memory.raidSent = false;
  }

  private queueSpawn(targetRoom: string, raidersNeeded: number, controlFlag: string): void {
    // TODO use closest spawn
    _.filter(Game.spawns, spawn => !spawn.spawning)
      .slice(0, raidersNeeded)
      .forEach(spawn => {
        const spawnQueue = SpawnQueue.getInstance(spawn.room);
        spawnQueue.push({
          bodyProfile: Raider.BODY_PROFILE,
          max: true,
          memory: {
            role: Raider.ROLE,
            targetRoom,
            controlFlag
          },
          sort: true,
          priority: 250
        });
      });
  }

  /** Room needs attack if recon shows creeps or structures */
  private roomNeedsAttack(roomName: string): boolean | undefined {
    const roomDefense = Memory.rooms[roomName].defense;
    return roomDefense && (roomDefense.creeps.length > 0 || roomDefense.structures.length > 0);
  }
}
