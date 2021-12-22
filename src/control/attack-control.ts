import { CreepRole } from "config/creep-types";
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

      const raidersAssigned = raiders.filter(raider => raider.memory.targetRoom === roomName);
      const spawningRaiders = SpawnUtils.getSpawnInfo(
        info => info.memory.role === CreepRole.RAIDER && info.memory.targetRoom === roomName
      );
      if (raidersAssigned.length + spawningRaiders.length === 0) {
        if (freeRaiders.length > 0) {
          // TODO assign closest raider
          freeRaiders[0].memory.targetRoom = roomName;
          continue;
        } else {
          this.queueSpawn(roomName);
        }
      }
    }
  }

  // TODO use cosest spawn
  private getClosestFreeSpawn(targetRoom: string): StructureSpawn | undefined {
    const availableSpawns = _.filter(Game.spawns, spawn => !spawn.spawning);
    return availableSpawns[0];
  }

  private queueSpawn(targetRoom: string): void {
    const spawn = this.getClosestFreeSpawn(targetRoom);
    if (spawn) {
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
    }
  }

  private roomNeedsAttack(roomName: string) {
    const roomDefense = Memory.rooms[roomName].defense;
    return roomDefense && (roomDefense.creeps.length > 0 || roomDefense.structures.length > 0);
  }
}
