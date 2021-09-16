// import { MemoryUtils } from "planning/memory-utils";
// import { RoomClaim } from "planning/room-claim";
// import { RoomWrapper } from "structures/room-wrapper";

import { CreepUtils } from "creep-utils";
import { Guard } from "roles/guard";

// export class DefenseControl {
//   public run(): void {
//     let defenseQueue = MemoryUtils.getCache<RoomClaim[]>("defenseQueue");
//     if (!defenseQueue) {
//       defenseQueue = [];
//     }

//     for (const roomName in Game.rooms) {
//       const roomw = new RoomWrapper(Game.rooms[roomName]);

//     }
//   }
// }
export class DefenseUtils {
  public static calcDefender(hostiles: Creep[]): BodyPartConstant[] {
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
