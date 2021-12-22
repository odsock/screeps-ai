import { CreepRole } from "config/creep-types";
import { SockPuppetConstants } from "config/sockpuppet-constants";
import { SpawnQueue } from "planning/spawn-queue";
import { Raider } from "roles/raider";
import { profile } from "../../screeps-typescript-profiler";
import { SpawnUtils } from "./spawn-utils";
import { TargetControl } from "./target-control";

@profile
export class AttackControl {
  public run(): void {
    console.log(`DEBUG: run attack control`);
    const raiders = _.filter(Game.creeps, c => c.memory.role === CreepRole.RAIDER);
    const freeRaiders = raiders.filter(raider => !this.roomNeedsAttack(raider.memory.targetRoom));

    // assign or spawn a raider for each unclean attack room
    for (const roomName of TargetControl.attackRooms) {
      const roomMemory = Memory.rooms[roomName];
      if (!roomMemory.defense || !this.roomNeedsAttack(roomName)) {
        console.log(`DEBUG: no attack ${roomName}`);
        continue;
      }
      console.log(`DEBUG: attack ${roomName}`);

      const attackFlag = _.find(
        Game.flags,
        flag => flag.pos.roomName === roomName && flag.color === SockPuppetConstants.FLAG_COLOR_ATTACK
      );
      const raidersRequested = attackFlag?.secondaryColor.valueOf() ?? 0;
      const raidersAssigned = raiders.filter(raider => raider.memory.targetRoom === roomName);
      const spawningRaiders = SpawnUtils.getSpawnInfo(
        info => info.memory.role === CreepRole.RAIDER && info.memory.targetRoom === roomName
      );
      let raidersNeeded = raidersRequested - raidersAssigned.length - spawningRaiders.length;
      if (raidersNeeded > 0) {
        if (freeRaiders.length > 0) {
          // TODO assign closest raider
          const reassignSlice = freeRaiders.splice(0, raidersNeeded);
          reassignSlice.forEach(creep => (creep.memory.targetRoom = roomName));
          raidersNeeded -= reassignSlice.length;
          continue;
        }
        if (raidersNeeded > 0) {
          this.queueSpawn(roomName, raidersNeeded);
        }
      }
    }
  }

  private queueSpawn(targetRoom: string, raidersNeeded: number): void {
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
            targetRoom
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
