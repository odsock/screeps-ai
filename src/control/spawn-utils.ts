import { CreepRole } from "config/creep-types";
import { CreepUtils } from "creep-utils";
import { SpawnQueue } from "planning/spawn-queue";
import { CreepBodyProfile, CreepWrapperProfile } from "roles/creep-wrapper";
import { RoomWrapper } from "structures/room-wrapper";
import { SpawnWrapper } from "structures/spawn-wrapper";
import { TravelUtils } from "utils/travel-utils";

export class SpawnUtils {
  /**
   * Creates creep body that could spawn with full capacity in room, based on profile.
   */
  // TODO implement maxWorkParts and other part type checks
  public static getMaxBody(creepBodyProfile: CreepBodyProfile, roomw: RoomWrapper): BodyPartConstant[] {
    // CreepUtils.consoleLogIfWatched(roomw, `get max body for ${JSON.stringify(creepBodyProfile)}`);
    let body: BodyPartConstant[] = creepBodyProfile.seed.slice();
    // if no profile return seed
    if (creepBodyProfile.profile.length === 0) {
      // CreepUtils.consoleLogIfWatched(roomw, `seed body: ${JSON.stringify(body)}`);
      return body;
    }
    // if no seed start with one instance of profile
    if (body.length === 0) {
      body = creepBodyProfile.profile.slice();
    }
    let finalBody: BodyPartConstant[] = [];
    creepBodyProfile.maxBodyParts = Math.min(creepBodyProfile.maxBodyParts, MAX_CREEP_SIZE);
    const energyCapacity = roomw.getEnergyCapacityAvailable();
    do {
      finalBody = body.slice();
      body = body.concat(creepBodyProfile.profile);
    } while (this.calcBodyCost(body) <= energyCapacity && body.length <= creepBodyProfile.maxBodyParts);
    // CreepUtils.consoleLogIfWatched(roomw, `final body: ${JSON.stringify(finalBody)}, room capacity: ${energyCapacity}`);
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
   * Calculates the number of ticks to spawn a creep with max body
   */
  public static calcSpawnTime(creepBodyProfile: CreepBodyProfile, roomw: RoomWrapper): number {
    const body = SpawnUtils.getMaxBody(creepBodyProfile, roomw);
    return body.length * CREEP_SPAWN_TIME;
  }

  /**
   * Updates a creep body profile with a max size based on number of parts needed for a part type
   */
  public static buildBodyProfile(
    bodyProfile: CreepBodyProfile,
    partsNeeded: number,
    type: BodyPartConstant
  ): CreepBodyProfile {
    const partsOfTypeInProfile = bodyProfile.profile.filter(part => part === type).length;
    bodyProfile.maxBodyParts =
      (partsNeeded / partsOfTypeInProfile) * bodyProfile.profile.length + bodyProfile.seed.length;
    return bodyProfile;
  }

  /** Gets count of creeps with role in room, including spawning creeps */
  public static getCreepCountForRole(roomw: RoomWrapper, role: CreepRole): number {
    const count = roomw
      .find(FIND_MY_CREEPS)
      .filter(creep => creep.memory.role === role && creep.memory.homeRoom === roomw.name).length;
    const numSpawning = SpawnUtils.getSpawningCountForRole(roomw, role);
    return count + numSpawning;
  }

  public static getSpawningCountForRole(roomw: RoomWrapper, role: CreepRole): number {
    return roomw.spawns.filter(spawn => spawn.spawning?.name.startsWith(role)).length;
  }

  /** Request spawn of replacement for oldest creep of type, if ticks to live less than replacement time */
  public static requestReplacementCreep(roomw: RoomWrapper, type: CreepWrapperProfile): void {
    const oldestCreep = SpawnUtils.findOldestCreepForRole(roomw, type);
    const ticksToReplace = SpawnUtils.calcSpawnTime(type.BODY_PROFILE, roomw);
    CreepUtils.consoleLogIfWatched(
      roomw,
      `oldest ${type.ROLE} ${String(oldestCreep?.ticksToLive)} ticks, ${ticksToReplace} ticks to replace`
    );
    if (oldestCreep?.ticksToLive && oldestCreep.ticksToLive <= ticksToReplace) {
      CreepUtils.consoleLogIfWatched(roomw, `spawning replacement ${type.ROLE}`);
      SpawnQueue.getInstance(roomw).push({
        bodyProfile: type.BODY_PROFILE,
        max: true,
        memory: {
          role: type.ROLE,
          replacing: oldestCreep.name
        },
        priority: 80
      });
    }
  }

  private static findOldestCreepForRole(roomw: RoomWrapper, type: CreepWrapperProfile) {
    return roomw
      .find(FIND_MY_CREEPS, { filter: creep => creep.memory.role === type.ROLE && !creep.memory.retiring })
      .reduce((oldest: Creep | undefined, c) => {
        if (!oldest || (c.ticksToLive && oldest.ticksToLive && c.ticksToLive < oldest.ticksToLive)) {
          return c;
        }
        return oldest;
      }, undefined);
  }

  /** count spawning creep parts in room for a type */
  public static getSpawningPartsForType(roomw: RoomWrapper, type: CreepRole, part: string): number {
    return roomw.spawns
      .filter(s => s.spawning && s.memory.spawning?.memory.role === type)
      .reduce<number>((count, s) => {
        const body = s.memory.spawning?.body ?? [];
        return count + body.filter(p => p === part).length;
      }, 0);
  }

  /** count spawning creep parts */
  public static countSpawningParts(part: BodyPartConstant, spawnInfo: SpawningInfo[]): number {
    return spawnInfo.reduce<number>((count, s) => {
      return (count += s.body.filter(p => p === part).length);
    }, 0);
  }

  /** count spawning creeps in roomw of type targetting targetRoom */
  public static getSpawningCountForTarget(roomw: RoomWrapper, type: CreepRole, targetRoom: string): number {
    return roomw.spawns.filter(
      s => s.spawning && s.memory.spawning?.memory.role === type && s.memory.spawning.memory.targetRoom === targetRoom
    ).length;
  }

  public static getSpawnInfoForRoom(
    roomw: RoomWrapper,
    filter: (info: SpawningInfo) => boolean = () => true
  ): SpawningInfo[] {
    const spawningInfos: SpawningInfo[] = [];
    roomw.spawns.forEach(s => {
      if (s.memory.spawning && filter(s.memory.spawning)) {
        spawningInfos.push(s.memory.spawning);
      }
    });
    return spawningInfos;
  }

  public static getSpawnInfo(filter: (info: SpawningInfo) => boolean = () => true): SpawningInfo[] {
    const spawningInfos: SpawningInfo[] = [];
    _.forEach(Game.spawns, s => {
      if (s.memory.spawning && filter(s.memory.spawning)) {
        spawningInfos.push(s.memory.spawning);
      }
    });
    return spawningInfos;
  }

  public static findClosestAvailableSpawnRoom(room: string | Room): string | undefined {
    const roomName = room instanceof Room ? room.name : room;
    const roomsWithAAvailableSpawns = _.filter(Game.spawns, s => !s.spawning).map(s => s.room.name);
    return TravelUtils.getInstance().findClosestRoom(roomName, roomsWithAAvailableSpawns);
  }
}
