import { CreepRole } from "config/creep-types";
import { CreepUtils } from "creep-utils";
import { CreepBodyProfile, CreepWrapperProfile } from "roles/creep-wrapper";
import { RoomWrapper } from "structures/room-wrapper";
import { SpawnWrapper } from "structures/spawn-wrapper";

export class SpawnUtils {
  /**
   * Creates creep body that could spawn with full capacity in room, based on profile.
   */
  // TODO implement maxWorkParts and other part type checks
  public static getMaxBody(creepBodyProfile: CreepBodyProfile, roomw: RoomWrapper): BodyPartConstant[] {
    let body: BodyPartConstant[] = creepBodyProfile.seed.slice();
    // if no seed start with one instance of profile
    if (body.length === 0) {
      body = creepBodyProfile.profile.slice();
    }
    let finalBody: BodyPartConstant[] = [];
    if (creepBodyProfile.maxBodyParts > MAX_CREEP_SIZE) {
      creepBodyProfile.maxBodyParts = MAX_CREEP_SIZE;
    }
    const energyCapacity = roomw.energyCapacityAvailable;
    do {
      finalBody = body.slice();
      body = body.concat(creepBodyProfile.profile);
    } while (this.calcBodyCost(body) <= energyCapacity && body.length <= creepBodyProfile.maxBodyParts);
    return finalBody;
  }

  /**
   * Creates creep body that can spawn this tick, based on profile.
   */
  public static getMaxBodyNow(bodyProfile: CreepBodyProfile, spawnw: SpawnWrapper): BodyPartConstant[] {
    // first make body as large as possible under 300 spawn energy
    let body = bodyProfile.seed.slice();
    let finalBody: BodyPartConstant[] = [];
    do {
      finalBody = body.slice();
      body = body.concat(bodyProfile.profile);
    } while (this.calcBodyCost(body) <= SPAWN_ENERGY_CAPACITY);
    body = finalBody.slice();

    // grow body until all available energy is used
    do {
      finalBody = body.slice();
      body = body.concat(bodyProfile.profile);
    } while (
      spawnw.spawnCreep(body, "maximizeBody", { dryRun: true }) === 0 &&
      body.length + bodyProfile.profile.length <= bodyProfile.maxBodyParts
    );
    return finalBody;
  }

  public static calcBodyCost(body: BodyPartConstant[]): number {
    return body.map(part => BODYPART_COST[part]).reduce((cost, partCost) => cost + partCost);
  }

  /**
   * Cuts creep body in half, keeping at least one of each part.
   * This may mean that a creep with many single parts may stay the same size.
   */
  public static splitBody(body: BodyPartConstant[]): BodyPartConstant[] {
    // get list of all types of part in body
    const bodyMinimum = body.reduce<BodyPartConstant[]>((min, part) => {
      if (!min.includes(part)) {
        min.push(part);
      }
      return min;
    }, []);

    // take every other part in body
    const newBody = body.filter((part, index) => index % 2);

    // add any missing types back in
    bodyMinimum.forEach(part => {
      if (!newBody.includes(part)) {
        newBody.push(part);
      }
    });
    return newBody;
  }

  /**
   * Calculates the number of ticks to spawn a creep with max body for retirement.
   * Uses an estimate of 50 ticks to account for walking time, since creep will be hauled.
   */
  public static calcReplacementTime(creepBodyProfile: CreepBodyProfile, roomw: RoomWrapper): number {
    const body = SpawnUtils.getMaxBody(creepBodyProfile, roomw);
    const spawningTime = body.length * CREEP_SPAWN_TIME;
    // walk time is hard to calc if using a hauler to tug
    // overestimate it, and suicide the retiree when you arrive
    const WALK_TIME = 50;
    const replacementTime = spawningTime + WALK_TIME;
    CreepUtils.consoleLogIfWatched(roomw, `replacement time: ${replacementTime} ticks`);
    return replacementTime;
  }

  /**
   * Updates a creep body profile with a max size based on number of work parts needed
   */
  public static buildBodyProfile(bodyProfile: CreepBodyProfile, workPartsNeeded: number): CreepBodyProfile {
    const workPartsInProfile = bodyProfile.profile.filter(part => part === WORK).length;
    bodyProfile.maxBodyParts =
      (workPartsNeeded / workPartsInProfile) * bodyProfile.profile.length + bodyProfile.seed.length;
    return bodyProfile;
  }

  /** Gets count of creeps with role, including spawning creeps */
  public static getCreepCountForRole(roomw: RoomWrapper, role: CreepRole): number {
    const count = roomw.find(FIND_MY_CREEPS).filter(creep => creep.memory.role === role).length;
    const numSpawning = roomw.spawns.filter(spawn => spawn.spawning?.name.startsWith(role)).length;
    return count + numSpawning;
  }
}
