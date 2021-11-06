import { CreepUtils } from "creep-utils";
import { SpawnQueue } from "planning/spawn-queue";
import { Guard } from "roles/guard";
import { RoomWrapper } from "structures/room-wrapper";
import { SpawnWrapper } from "structures/spawn-wrapper";
import { profile } from "../../screeps-typescript-profiler";
import { TargetControl } from "./target-control";

@profile
export class DefenseControl {
  public run(): void {
    // spawn guard for each unguarded room with hostiles
    for (const roomName in Memory.rooms) {
      const roomMemory = Memory.rooms[roomName];
      if (!roomMemory) {
        continue;
      }
      // TODO find a better way to get my username
      const roomIsMine = roomMemory.owner === _.find(Game.spawns, () => true)?.owner.username;
      const remoteHarvestRoom = TargetControl.isRemoteHarvestRoom(roomName);
      const targetedRoom = TargetControl.isTargetRoom(roomName);
      const defendedRoom = roomIsMine || remoteHarvestRoom || targetedRoom;
      if (!defendedRoom) {
        continue;
      }

      const roomDefense = roomMemory.defense;
      if (roomDefense && (roomDefense.creeps.length > 0 || roomDefense.structures.length > 0)) {
        const spawningGuards = this.getSpawningGuardCount(roomName);
        const guardsAssigned = _.filter(
          Game.creeps,
          creep => creep.memory.role === Guard.ROLE && creep.memory.targetRoom === roomName
        );
        if (guardsAssigned.length + spawningGuards === 0) {
          console.log(`DEBUG: defense room name `, roomName);
          const room = Game.rooms[roomName];
          console.log(`DEBUG: defense room `, room);
          if (room) {
            console.log(`DEBUG: getting wrapper for ${roomName}`);
            const roomw = RoomWrapper.getInstance(room);
            if (roomw) {
              // try to pop a safe mode if being attacked
              this.activateSafeModeIfAttacked(roomw);

              // try to spawn guard in the room
              const availableSpawnsInRoom = roomw.spawns.filter(spawn => !spawn.spawning);
              if (availableSpawnsInRoom.length) {
                const spawnw = availableSpawnsInRoom[0];
                return this.spawnGuard(roomDefense, spawnw, roomName);
              }
            }
          }

          // try to spawn in nearby room
          const availableSpawns = _.filter(Game.spawns, spawn => !spawn.spawning);
          if (availableSpawns.length) {
            // TODO find closest room with spawn
            // const posInRoom = new RoomPosition(10, 10, roomName);
            // const closestSpawn = posInRoom.findClosestByPath(availableSpawns);
            // if (closestSpawn) {
            return this.spawnGuard(roomDefense, new SpawnWrapper(availableSpawns[0]), roomName);
            //   }
          }
        }
      }
    }
  }

  private getSpawningGuardCount(roomName: string) {
    return _.filter(
      Game.spawns,
      s =>
        s.spawning && s.memory.spawning?.memory.role === Guard.ROLE && s.memory.spawning.memory.targetRoom === roomName
    ).length;
  }

  private spawnGuard(roomDefense: RoomDefense, spawnw: SpawnWrapper, roomName: string): void {
    const spawnQueue = SpawnQueue.getInstance(spawnw.room);

    // spawn with what is available now if creeps in room
    // request max size if hostile structure only (probably an invader core, so we can wait)
    const hostileCreepsInRoom = roomDefense.creeps.length === 0;

    spawnQueue.push({
      bodyProfile: Guard.BODY_PROFILE,
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
      const armorCost = toughPartsNeeded * BODYPART_COST.tough + movePartsNeeded * BODYPART_COST.move;

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
