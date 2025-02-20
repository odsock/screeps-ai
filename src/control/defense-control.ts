import { CreepRole } from "config/creep-types";
import { CreepUtils } from "creep-utils";
import { SpawnQueue } from "planning/spawn-queue";
import { Guard } from "roles/guard";
import { RoomWrapper } from "structures/room-wrapper";
import { TargetControl } from "./target-control";

import { profile } from "../../screeps-typescript-profiler";
import { SpawnUtils } from "./spawn-utils";

@profile
export class DefenseControl {
  private readonly targetControl: TargetControl;
  public constructor() {
    this.targetControl = TargetControl.getInstance();
  }

  public run(): void {
    const guards = _.filter(Game.creeps, c => c.memory.role === CreepRole.GUARD);
    const freeGuards = guards.filter(guard => !this.roomNeedsDefense(guard.memory.targetRoom));

    // assign or spawn a guard for each unguarded room with hostiles
    for (const roomName in Memory.rooms) {
      const roomMemory = Memory.rooms[roomName];
      if (
        !roomMemory.defense ||
        !this.isDefendedRoom(roomName) ||
        !this.roomNeedsDefense(roomName)
      ) {
        continue;
      }

      const guardsAssigned = guards.filter(guard => guard.memory.targetRoom === roomName);
      const spawningGuards = this.getSpawningGuardCount(roomName);
      if (guardsAssigned.length + spawningGuards === 0) {
        if (freeGuards.length > 0) {
          // TODO assign closest guard
          freeGuards[0].memory.targetRoom = roomName;
          continue;
        } else {
          this.spawnGuardForRoom(roomName);
        }
      }

      const roomDefense = Memory.rooms[roomName].defense;
      if (roomDefense && roomDefense.creeps.length > guardsAssigned.length + spawningGuards) {
        this.spawnRangedGuardForRoom(roomName);
      }
    }
  }

  private spawnGuardForRoom(roomName: string): void {
    const availableSpawns = _.filter(Game.spawns, spawn => !spawn.spawning);
    const spawnsInRoom = availableSpawns.filter(spawn => spawn.room.name === roomName);
    // TODO use cosest spawn
    const spawn = spawnsInRoom[0] ?? availableSpawns[0];
    if (spawn) {
      this.spawnGuard(spawn, roomName);
    }
  }

  private spawnRangedGuardForRoom(roomName: string): void {
    const availableSpawns = _.filter(Game.spawns, spawn => !spawn.spawning);
    const spawnsInRoom = availableSpawns.filter(spawn => spawn.room.name === roomName);
    // TODO use cosest spawn
    const spawn = spawnsInRoom[0] ?? availableSpawns[0];
    if (spawn) {
      this.spawnRangedGuard(spawn, roomName);
    }
  }

  private isDefendedRoom(roomName: string): boolean {
    return (
      Memory.rooms[roomName].owner === Memory.username ||
      this.targetControl.remoteHarvestRooms.includes(roomName) ||
      this.targetControl.targetRooms.includes(roomName)
    );
  }

  private roomNeedsDefense(roomName: string): boolean | undefined {
    const roomDefense = Memory.rooms[roomName].defense;
    return roomDefense && (roomDefense.creeps.length > 0 || roomDefense.structures.length > 0);
  }

  private getSpawningGuardCount(roomName: string): number {
    return _.filter(
      Game.spawns,
      s =>
        s.spawning &&
        s.memory.spawning?.memory.role === Guard.ROLE &&
        s.memory.spawning.memory.targetRoom === roomName
    ).length;
  }

  private spawnGuard(spawn: StructureSpawn, roomName: string): void {
    const spawnQueue = SpawnQueue.getInstance(spawn.room);

    // spawn with what is available now if creeps in room
    // request max size if hostile structure only (probably an invader core, so we can wait)
    const hostileCreepsInRoom = spawn.room.memory.defense?.creeps.length === 0;

    const spawnCapacity = spawn.room.energyCapacityAvailable;
    const guardSeedCost = SpawnUtils.calcBodyCost(Guard.BODY_PROFILE.seed);
    let bodyProfile = Guard.BODY_PROFILE;
    if (guardSeedCost > spawnCapacity) {
      bodyProfile = Guard.BODY_PROFILE_SMALL;
    }

    spawnQueue.push({
      bodyProfile,
      max: hostileCreepsInRoom,
      memory: {
        role: Guard.ROLE,
        targetRoom: roomName
      },
      sort: true,
      priority: 250
    });
  }

  private spawnRangedGuard(spawn: StructureSpawn, roomName: string): void {
    const spawnQueue = SpawnQueue.getInstance(spawn.room);

    // spawn with what is available now if creeps in room
    // request max size if hostile structure only (probably an invader core, so we can wait)
    const hostileCreepsInRoom = spawn.room.memory.defense?.creeps.length === 0;

    const spawnCapacity = spawn.room.energyCapacityAvailable;
    const guardSeedCost = SpawnUtils.calcBodyCost(Guard.BODY_PROFILE.seed);
    let bodyProfile = Guard.BODY_PROFILE_RANGED;
    if (guardSeedCost > spawnCapacity) {
      bodyProfile = Guard.BODY_PROFILE_RANGED_SMALL;
    }

    spawnQueue.push({
      bodyProfile,
      max: hostileCreepsInRoom,
      memory: {
        role: Guard.ROLE,
        targetRoom: roomName
      },
      sort: true,
      priority: 250
    });
  }

  private activateSafeModeIfAttacked(room: RoomWrapper): void {
    const attacksLastTick = room.getEventLog().filter(item => item.event === EVENT_ATTACK);
    const attackedMeLastTick = attacksLastTick
      .map(item => {
        if (item.event === EVENT_ATTACK) {
          const target = Game.getObjectById(item.data.targetId as Id<Creep | Structure>);
          if (target) {
            if (target instanceof Creep) {
              return target.my;
            } else {
              return true;
            }
          }
        }
        return false;
      })
      .some(flag => flag);
    if (attackedMeLastTick && room?.controller?.safeModeAvailable) {
      room.controller.activateSafeMode();
    }
  }

  public mirrorHostilesBodyForDefense(hostiles: Creep[]): BodyPartConstant[] {
    // lump them all together
    const hostileBodies = hostiles.reduce<BodyPartConstant[]>((bodyAcc, hostile) => {
      return bodyAcc.concat(hostile.body.map(part => part.type));
    }, []);
    // copy body replacing work and ranged with tough, and ranged with attack
    const body = hostileBodies
      .map(part => (part === WORK ? TOUGH : part))
      .map(part => (part === RANGED_ATTACK ? ATTACK : part));
    return body;
  }

  public calcGuardBody(hostiles: Creep[]): BodyPartConstant[] {
    const hostileAttackParts = CreepUtils.countParts(ATTACK, ...hostiles);
    const hostileAttackPower = hostileAttackParts * ATTACK_POWER;
    const hostileHits = hostiles.reduce<number>((count, creep) => count + creep.hitsMax, 0);

    const guardAttackParts = Guard.BODY_PROFILE.seed.filter(part => part === ATTACK).length;
    const guardAttackPower = guardAttackParts * ATTACK_POWER;
    const guardHits = Guard.BODY_PROFILE.seed.length * 100;

    const body = Guard.BODY_PROFILE.seed;
    const guardSurvivalTime = guardHits / hostileAttackPower;
    const hostileSurvivalTime = hostileHits / guardAttackPower;
    if (guardSurvivalTime < hostileSurvivalTime) {
      const survivalDiff = hostileSurvivalTime - guardSurvivalTime;

      // calc how many parts to add to take the damage
      const damageDiff = survivalDiff * hostileAttackPower;
      const bodyPartsNeeded = Math.ceil(damageDiff / 100);
      const toughPartsNeeded = Math.floor(bodyPartsNeeded / 2);
      const movePartsNeeded = Math.ceil(bodyPartsNeeded / 2);
      const armorCost =
        toughPartsNeeded * BODYPART_COST.tough + movePartsNeeded * BODYPART_COST.move;

      // calc how many attack parts to add to kill first
      const attackPowerNeeded = hostileHits / guardSurvivalTime;
      let attackPartsNeeded = attackPowerNeeded / ATTACK_POWER - guardAttackParts;
      for (let count = 1; count <= attackPartsNeeded; count++) {
        const newGuardSurvivalTime = (guardHits + count * 200) / hostileAttackPower;
        const newHostileSurvivalTime = hostileHits / (guardAttackPower + ATTACK_POWER * count);
        if (newGuardSurvivalTime > newHostileSurvivalTime) {
          attackPartsNeeded = count;
          break;
        }
      }
      const attackCost = attackPartsNeeded * (BODYPART_COST.attack + BODYPART_COST.move);

      // TODO these loops are dumb
      if (armorCost < attackCost) {
        for (let count = 0; count < movePartsNeeded; count++) {
          body.unshift(MOVE);
        }
        for (let count = 0; count < toughPartsNeeded; count++) {
          body.unshift(TOUGH);
        }
      } else {
        for (let count = 0; count < attackPartsNeeded; count++) {
          body.push(ATTACK);
        }
        for (let count = 0; count < attackPartsNeeded; count++) {
          body.unshift(MOVE);
        }
      }
    }
    return body;
  }
}
