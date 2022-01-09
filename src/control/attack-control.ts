import { CreepRole } from "config/creep-types";
import { SockPuppetConstants } from "config/sockpuppet-constants";
import { SpawnQueue } from "planning/spawn-queue";
import { Raider } from "roles/raider";
import { TravelUtils } from "utils/travel-utils";
import { profile } from "../../screeps-typescript-profiler";
import { SpawnUtils } from "./spawn-utils";
import { TargetControl } from "./target-control";

declare global {
  interface FlagMemory {
    rallyRoom?: string;
    raidSent?: boolean;
  }
}

@profile
export class AttackControl {
  private readonly targetControl: TargetControl;
  public constructor() {
    this.targetControl = TargetControl.getInstance();
  }

  public run(): void {
    const raiders = _.filter(Game.creeps, c => c.memory.role === CreepRole.RAIDER);
    const freeRaiders = raiders.filter(raider => !this.roomNeedsAttack(raider.memory.targetRoom));

    // assign or spawn a raider for each unclean attack room
    for (const roomName of this.targetControl.attackRooms) {
      const roomMemory = Memory.rooms[roomName];
      if (!roomMemory.defense || !this.roomNeedsAttack(roomName)) {
        continue;
      }

      const attackFlag = _.find(
        Game.flags,
        flag => flag.pos.roomName === roomName && flag.color === SockPuppetConstants.FLAG_COLOR_ATTACK
      );
      if (attackFlag) {
        const raidersAssigned = raiders.filter(raider => raider.memory.targetRoom === roomName);
        // increase raiding party size if previous raid failed
        if (attackFlag.memory.raidSent && raidersAssigned.length === 0 && attackFlag.secondaryColor < 10) {
          attackFlag.secondaryColor += 1;
          attackFlag.memory.raidSent = false;
        }
        // secondary flag color constant is proxy for raiding party size
        const raidersRequested = attackFlag.secondaryColor.valueOf() ?? 0;
        const spawningRaiders = SpawnUtils.getSpawnInfo(
          info => info.memory.role === CreepRole.RAIDER && info.memory.targetRoom === roomName
        );
        let raidersStillNeeded = raidersRequested - raidersAssigned.length - spawningRaiders.length;
        // remove rally point if raiding party is ready (triggers attack)
        if (
          raidersRequested <= raidersAssigned.length &&
          raidersAssigned.every(r => r.room.name === attackFlag.memory.rallyRoom)
        ) {
          raidersAssigned.forEach(r => delete r.memory.rallyRoom);
          attackFlag.memory.raidSent = true;
        } else if (raidersStillNeeded > 0) {
          const rallyRoom =
            attackFlag.memory.rallyRoom ??
            TravelUtils.findClosestRoom(
              roomName,
              this.targetControl.claimedRooms.concat(this.targetControl.remoteHarvestRooms)
            );
          attackFlag.memory.rallyRoom = rallyRoom;
          if (!rallyRoom) {
            console.log(`ERROR: no rally room found`);
          } else {
            if (freeRaiders.length > 0) {
              // TODO assign closest raider
              const reassignSlice = freeRaiders.splice(0, raidersStillNeeded);
              reassignSlice.forEach(creep => (creep.memory.targetRoom = roomName));
              raidersStillNeeded -= reassignSlice.length;
              continue;
            }
            if (raidersStillNeeded > 0) {
              this.queueSpawn(roomName, raidersStillNeeded, rallyRoom);
            }
          }
        }
      }
    }
  }

  private queueSpawn(targetRoom: string, raidersNeeded: number, rallyRoom: string): void {
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
            rallyRoom
          },
          sort: true,
          priority: 250
        });
      });
  }

  private roomNeedsAttack(roomName: string) {
    const roomDefense = Memory.rooms[roomName].defense;
    return roomDefense && (roomDefense.creeps.length > 0 || roomDefense.structures.length > 0);
  }
}
