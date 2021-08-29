import { Constants } from "./constants";
import { CreepUtils } from "creep-utils";
import { Builder } from "roles/builder";
import { Claimer } from "roles/claimer";
import { CreepFactory } from "roles/creep-factory";
import { Fixer } from "roles/fixer";
import { Hauler } from "roles/hauler";
import { Importer } from "roles/importer";
import { Minder } from "roles/minder";
import { Worker } from "roles/worker";
import { RoomWrapper } from "structures/room-wrapper";
import { TargetConfig } from "target-config";
import { SpawnWrapper } from "structures/spawn-wrapper";

export const enum CreepRole {
  BUILDER = "builder",
  CLAIMER = "claimer",
  FIXER = "fixer",
  HAULER = "hauler",
  IMPORTER = "importer",
  MINDER = "minder",
  WORKER = "worker"
}

export class PopulationControl {
  private readonly workers: Worker[];
  private readonly minders: Minder[];
  private readonly haulers: Hauler[];
  private readonly builders: Builder[];
  private readonly fixers: Fixer[];
  private readonly importers: Importer[];

  private readonly containers: AnyStructure[];
  private readonly rcl: number;
  private readonly claimers: Claimer[];
  private spawns: SpawnWrapper[];

  public constructor(private readonly roomw: RoomWrapper) {
    this.spawns = this.roomw.spawns;
    const creeps = this.roomw.find(FIND_MY_CREEPS);

    // TODO don't new up wrappers each tick
    this.workers = creeps.filter(c => c.memory.role === CreepRole.WORKER).map(c => new Worker(c));
    this.builders = creeps.filter(c => c.memory.role === CreepRole.BUILDER).map(c => new Builder(c));
    this.minders = creeps.filter(c => c.memory.role === CreepRole.MINDER).map(c => new Minder(c));
    this.haulers = creeps.filter(c => c.memory.role === CreepRole.HAULER).map(c => new Hauler(c));
    this.fixers = creeps.filter(c => c.memory.role === CreepRole.FIXER).map(c => new Fixer(c));

    this.containers = this.roomw.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_CONTAINER });
    this.rcl = this.roomw.controller?.level ? this.roomw.controller?.level : 0;

    this.claimers = _.filter(Game.creeps, c => c.memory.role === CreepRole.CLAIMER).map(c => new Claimer(c));
    this.importers = _.filter(Game.creeps, c => c.memory.role === CreepRole.IMPORTER).map(c => new Importer(c));
  }

  public run(): void {
    this.spawns
      .filter(spawnw => !spawnw.spawning)
      .some(spawnw => {
        // make sure there is at least one minder if there is a container
        if (this.containers.length > 0 && this.minders.length === 0) {
          return this.spawnBootstrapCreep(Minder.BODY_PROFILE, Minder.ROLE, spawnw) !== OK;
        }

        // make sure there is at least one hauler if there is a container
        const maxHaulerCount = this.getMaxHaulerCount();
        if (maxHaulerCount > 0 && this.haulers.length === 0) {
          return this.spawnBootstrapCreep(Hauler.BODY_PROFILE, Hauler.ROLE, spawnw) !== OK;
        }

        // spawn minder for each container
        if (this.minders.length < this.containers.length) {
          return this.spawnBootstrapCreep(Minder.BODY_PROFILE, Minder.ROLE, spawnw) !== OK;
        }

        // TODO: probably hauler numbers should depend on the length of route vs upgrade work speed
        if (this.haulers.length < maxHaulerCount) {
          return this.spawnBootstrapCreep(Hauler.BODY_PROFILE, Hauler.ROLE, spawnw) !== OK;
        }

        if (this.workers.length < this.getMaxWorkerCount()) {
          return this.spawnBootstrapCreep(Worker.BODY_PROFILE, Worker.ROLE, spawnw);
        }

        if (this.fixers.length < Constants.MAX_FIXER_CREEPS) {
          return spawnw.spawn(this.getMaxBody(Fixer.BODY_PROFILE), Fixer.ROLE) !== OK;
        }

        // TODO importer numbers should depend on room reserved or not, etc
        if (this.importers.length < TargetConfig.REMOTE_HARVEST[Game.shard.name].length * 3) {
          return spawnw.spawn(this.getMaxBody(Importer.BODY_PROFILE), Importer.ROLE) !== OK;
        }

        // make builders if there's something to build and past level 1
        const workPartsNeeded = this.getBuilderWorkPartsNeeded();
        if (this.workers.length === 0 && this.roomw.constructionSites.length > 0 && workPartsNeeded > 0) {
          return spawnw.spawn(this.getBuilderBody(Builder.BODY_PROFILE, workPartsNeeded), Builder.ROLE) !== OK;
        }

        const maxClaimers = this.getMaxClaimerCount();
        if (this.claimers.length < maxClaimers) {
          return spawnw.spawn(this.getMaxBody(Claimer.BODY_PROFILE), Claimer.ROLE) !== OK;
        }

        // TODO: replace small minders early, for faster recovery from attack or mistakes
        // try to replace any aging minder seamlessly
        return this.replaceOldMinders(spawnw) !== OK;
      });

    // print role of spawning creep as visual
    this.spawns.forEach(spawn => {
      if (spawn.spawning) {
        const spawningCreep = Game.creeps[spawn.spawning.name];
        this.roomw.visual.text("🐣" + spawningCreep.memory.role, spawn.pos.x + 1, spawn.pos.y, {
          align: "left",
          opacity: 0.8
        });
      }
    });
  }

  private spawnBootstrapCreep(profile: CreepBodyProfile, role: CreepRole, spawnw: SpawnWrapper) {
    let body: BodyPartConstant[];
    if (this.minders.length <= 0) {
      body = this.getMaxBodyNow(profile, spawnw);
    } else {
      body = this.getMaxBody(profile);
    }
    const result = spawnw.spawn(body, role);
    return result;
  }

  private replaceOldMinders(spawnw: SpawnWrapper): ScreepsReturnCode {
    for (const creep of this.minders) {
      const minder = CreepFactory.getCreep(creep);
      if (!minder.spawning && !minder.memory.retiring === true) {
        const body = this.getMaxBody(Minder.BODY_PROFILE);
        const ticksToSpawn = body.length * CREEP_SPAWN_TIME;
        const pathToReplace = CreepUtils.getPath(spawnw.pos, minder.pos);
        const ticksToReplace = minder.calcWalkTime(pathToReplace);
        if (minder.ticksToLive && minder.ticksToLive <= ticksToSpawn + ticksToReplace) {
          const result = this.spawnBootstrapCreep(Minder.BODY_PROFILE, Minder.ROLE, spawnw);
          if (result === OK) {
            minder.memory.retiring = true;
          }
          return result;
        }
      }
    }
    return OK;
  }

  /** plan creep count functions */

  private getMaxClaimerCount(): number {
    const targetRoomNames = TargetConfig.TARGETS[Game.shard.name];
    if (targetRoomNames) {
      return targetRoomNames.filter(roomName => {
        // validate room name
        try {
          new RoomPosition(0, 0, roomName);
          // can't do this without a creep in the room
        } catch (error) {
          console.log(`ERROR: bad target config: ${roomName}`);
          return false;
        }
        // don't spawn claimers for rooms we own
        if (Game.rooms[roomName]?.controller?.my) {
          return false;
        }
        return true;
      }).length;
    }
    return 0;
  }

  // TODO: make this depend on the distance from sources to controller/spawn/storage
  private getMaxHaulerCount(): number {
    return this.roomw.sourceContainers.length;
  }

  // TODO seems like this belongs in planner
  private getMaxWorkerCount(): number {
    // make workers in early stages
    if (this.rcl <= 1 || (this.containers.length === 0 && this.minders.length === 0)) {
      return this.roomw.harvestPositions.length;
    }
    return 0;
  }

  /** calculate creep bodies */

  // TODO: generalize this for any parts requirement
  private getBuilderBody(bodyProfile: CreepBodyProfile, workPartsNeeded: number): BodyPartConstant[] {
    const workPartsInProfile = bodyProfile.profile.filter(part => part === WORK).length;
    bodyProfile.maxBodyParts =
      (workPartsNeeded / workPartsInProfile) * bodyProfile.profile.length + bodyProfile.seed.length;
    const body = this.getMaxBody(bodyProfile);
    return body;
  }

  private getBuilderWorkPartsNeeded(): number {
    const conWork = this.roomw.constructionWork;
    const activeWorkParts = this.builders.reduce<number>((count: number, creep) => count + creep.countParts(WORK), 0);
    const workPartsNeeded = Math.ceil(conWork / Constants.WORK_PER_WORKER_PART);
    const workPartsDeficit = workPartsNeeded - activeWorkParts;
    return workPartsDeficit > 0 ? workPartsDeficit : 0;
  }

  /**
   * Creates creep body profile based on array of body constants and max size allowed.
   */
  // TODO implement maxWorkParts and other checks
  private getMaxBody(creepBodyProfile: CreepBodyProfile) {
    let body: BodyPartConstant[] = creepBodyProfile.seed.slice();
    let finalBody: BodyPartConstant[] = [];
    if (creepBodyProfile.maxBodyParts > MAX_CREEP_SIZE) {
      creepBodyProfile.maxBodyParts = MAX_CREEP_SIZE;
    }
    const energyCapacity = this.roomw.energyCapacityAvailable;
    do {
      finalBody = body.slice();
      body = body.concat(creepBodyProfile.profile);
    } while (this.calcBodyCost(body) <= energyCapacity && body.length <= creepBodyProfile.maxBodyParts);
    return finalBody.sort();
  }

  private getMaxBodyNow(bodyProfile: CreepBodyProfile, spawnw: SpawnWrapper) {
    // first make body as large as possible under 300 spawn energy
    let body = bodyProfile.seed.slice();
    let finalBody: BodyPartConstant[] = [];
    do {
      finalBody = body.slice();
      body = body.concat(bodyProfile.profile);
    } while (this.calcBodyCost(body) < SPAWN_ENERGY_CAPACITY);
    body = finalBody.slice();

    // grow body until all available energy is used
    do {
      finalBody = body.slice();
      body = body.concat(bodyProfile.profile);
    } while (
      spawnw.spawnCreep(body, "maximizeBody", { dryRun: true }) === 0 &&
      body.length + bodyProfile.profile.length <= bodyProfile.maxBodyParts
    );
    return finalBody.sort();
  }

  private calcBodyCost(body: BodyPartConstant[]): number {
    return body.map(part => BODYPART_COST[part]).reduce((cost, partCost) => cost + partCost);
  }
}
