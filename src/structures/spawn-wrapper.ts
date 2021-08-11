import { CreepUtils } from "creep-utils";
import { Builder } from "roles/builder";
import { Claimer } from "roles/claimer";
import { CreepFactory } from "roles/creep-factory";
import { Fixer } from "roles/fixer";
import { Hauler } from "roles/hauler";
import { Minder } from "roles/minder";
import { Worker } from "roles/worker";
import { TargetConfig } from "target-config";
import { Constants } from "../constants";
import { RoomWrapper } from "./room-wrapper";

export class SpawnWrapper extends StructureSpawn {
  private readonly workers: Worker[];
  private readonly minders: Minder[];
  private readonly haulers: Hauler[];
  private readonly builders: Builder[];
  private readonly fixers: Fixer[];

  private readonly containers: AnyStructure[];
  private readonly rcl: number;
  private readonly roomw: RoomWrapper;
  private readonly claimers: Claimer[];

  public constructor(spawn: StructureSpawn) {
    super(spawn.id);
    this.roomw = new RoomWrapper(spawn.room);

    const creeps = this.room.find(FIND_MY_CREEPS);
    this.workers = creeps.filter(c => c.memory.role === "worker").map(c => new Worker(c));
    this.builders = creeps.filter(c => c.memory.role === "builder").map(c => new Builder(c));
    this.minders = creeps.filter(c => c.memory.role === "minder").map(c => new Minder(c));
    this.haulers = creeps.filter(c => c.memory.role === "hauler").map(c => new Hauler(c));
    this.fixers = creeps.filter(c => c.memory.role === "fixer").map(c => new Fixer(c));
    this.containers = this.room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_CONTAINER });
    this.rcl = this.room.controller?.level ? this.room.controller?.level : 0;

    this.claimers = _.filter(Game.creeps, c => c.memory.role === "claimer").map(c => new Claimer(c));
  }

  public spawnCreeps(): void {
    if (!this.spawning) {
      CreepUtils.consoleLogIfWatched(this, `spawn creeps`);

      // make sure there is at least one minder if there is a container
      if (this.containers.length > 0 && this.minders.length === 0) {
        this.spawnMinder(`minder`);
        return;
      }

      // make sure there is at least one hauler if there is a container
      const maxHaulerCount = this.getMaxHaulerCount();
      if (maxHaulerCount > 0 && this.haulers.length === 0) {
        this.spawnHauler();
        return;
      }

      // spawn minder for each container
      if (this.minders.length < this.containers.length) {
        this.spawnMinder(`minder`);
        return;
      }

      // TODO: probably hauler numbers should depend on the length of route vs upgrade work speed
      if (this.haulers.length < maxHaulerCount) {
        this.spawnHauler();
        return;
      }

      if (this.workers.length < this.getMaxWorkerCount()) {
        this.spawnWorker();
        return;
      }

      if (this.fixers.length < Constants.MAX_FIXER_CREEPS) {
        this.spawnFixer();
        return;
      }

      // make builders if there's something to build and past level 1
      const workPartsNeeded = this.getBuilderWorkPartsNeeded();
      if (this.workers.length === 0 && this.roomw.constructionSites.length > 0 && workPartsNeeded > 0) {
        this.spawnBuilder(workPartsNeeded);
        return;
      }

      const maxClaimers = this.getMaxClaimerCount();
      if (this.claimers.length < maxClaimers) {
        this.spawnClaimer();
        return;
      }

      // TODO: replace small minders early, for faster recovery from attack or mistakes
      // try to replace any aging harvester early
      this.replaceOldMinders();
    }

    if (this.spawning) {
      const spawningCreep = Game.creeps[this.spawning.name];
      this.room.visual.text("🛠️" + spawningCreep.memory.role, this.pos.x + 1, this.pos.y, {
        align: "left",
        opacity: 0.8
      });
    }
  }
  private spawnFixer(): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `- spawning fixer`);
    return this.spawn(this.getMaxBody(Constants.BODY_PROFILE_FIXER), "fixer");
  }

  private spawnClaimer(): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `- spawning claimer`);
    return this.spawn(this.getClaimerBody(), "claimer");
  }

  private getClaimerBody(): BodyPartConstant[] {
    return this.getMaxBody(Constants.BODY_PROFILE_CLAIMER);
  }

  private getMaxClaimerCount(): number {
    const targetRoomNames = TargetConfig.TARGETS[Game.shard.name];
    if (targetRoomNames) {
      return targetRoomNames.filter(roomName => {
        if (Game.rooms[roomName]) {
          return false;
        }
        try {
          new RoomPosition(0, 0, roomName);
        } catch (error) {
          console.log(`ERROR: bad target config: ${roomName}`);
          return false;
        }
        return true;
      }).length;
    }
    return 0;
  }

  private replaceOldMinders() {
    for (const creep of this.minders) {
      const minder = CreepFactory.getCreep(creep);
      if (!minder.spawning && !minder.memory.retiring === true) {
        const body = this.getBody(creep.memory.role);
        const ticksToSpawn = body.length * CREEP_SPAWN_TIME;
        const pathToReplace = CreepUtils.getPath(this.pos, minder.pos);
        const ticksToReplace = minder.calcWalkTime(pathToReplace);
        CreepUtils.consoleLogIfWatched(
          this,
          `- minder retirement check: ${minder.name}: ticksToLive: ${String(
            minder.ticksToLive
          )}, ticksToSpawn: ${ticksToSpawn}, pathCost: ${ticksToReplace}`
        );
        if (minder.ticksToLive && minder.ticksToLive <= ticksToSpawn + ticksToReplace) {
          const result = this.spawnMinder(minder.name);
          if (result === OK) {
            minder.memory.retiring = true;
          }
        }
      }
    }
  }

  // TODO: make this depend on the distance from sources to controller/spawn/storage
  private getMaxHaulerCount(): number {
    return this.roomw.sourceContainers.length;
  }

  // TODO seems like this belongs in planner
  private getMaxWorkerCount(): number {
    // make workers in early stages
    if (this.rcl <= 1 || (this.containers.length === 0 && this.minders.length === 0)) {
      CreepUtils.consoleLogIfWatched(this, `- max workers: ${Constants.MAX_WORKERS}`);
      return this.roomw.harvestPositions.length;
    }
    return 0;
  }

  private getBuilderBody(workPartsNeeded: number): BodyPartConstant[] {
    const bodyProfile = Constants.BODY_PROFILE_BUILDER;
    const workPartsInProfile = bodyProfile.profile.filter(part => part === WORK).length;
    bodyProfile.maxBodyParts =
      (workPartsNeeded / workPartsInProfile) * bodyProfile.profile.length + bodyProfile.seed.length;
    CreepUtils.consoleLogIfWatched(this, ` - max body parts: ${bodyProfile.maxBodyParts}`);
    const body = this.getMaxBody(bodyProfile);
    CreepUtils.consoleLogIfWatched(
      this,
      ` - needed ${workPartsNeeded} parts, body: ${CreepUtils.creepBodyToString(body)}`
    );
    return body;
  }

  private getBuilderWorkPartsNeeded(): number {
    const conWork = this.roomw.constructionWork;
    const activeWorkParts = this.builders.reduce<number>((count: number, creep) => count + creep.countParts(WORK), 0);
    const workPartsNeeded = Math.ceil(conWork / Constants.WORK_PER_WORKER_PART);
    const workPartsDeficit = workPartsNeeded - activeWorkParts;
    CreepUtils.consoleLogIfWatched(
      this,
      `- calc builder parts needed: ${workPartsNeeded}, active: ${activeWorkParts}, work: ${conWork}, deficit: ${workPartsDeficit}`
    );
    return workPartsDeficit > 0 ? workPartsDeficit : 0;
  }

  private spawnBuilder(workPartsNeeded: number): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `- spawning builder`);
    return this.spawn(this.getBuilderBody(workPartsNeeded), "builder");
  }

  private spawnWorker(): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `- spawning worker`);
    let body: BodyPartConstant[];
    if (this.workers.length < 1) {
      body = this.getMaxBodyNow(Constants.BODY_PROFILE_WORKER);
    } else {
      body = this.getMaxBody(Constants.BODY_PROFILE_WORKER);
    }
    return this.spawn(body, "worker");
  }

  private spawnMinder(retireeName?: string): ScreepsReturnCode {
    const role = "minder";
    CreepUtils.consoleLogIfWatched(this, ` - spawning ${role}`);
    const body: BodyPartConstant[] = this.getBody(role);
    return this.spawn(body, role, retireeName);
  }

  private spawnHauler(): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `- spawning hauler`);
    const body: BodyPartConstant[] = this.getHaulerBody();
    return this.spawn(body, "hauler");
  }

  private getBody(role: string): BodyPartConstant[] {
    switch (role) {
      case "minder":
        return this.getMinderBody();
      case "hauler":
        return this.getHaulerBody();

      default:
        throw new Error(`Unknown creep role: ${role}`);
    }
  }

  private getMinderBody(): BodyPartConstant[] {
    let body = this.getMaxBody(Constants.BODY_PROFILE_MINDER);
    if (
      this.minders.length <= 0 &&
      this.workers.length <= 0 &&
      this.spawnCreep(body, "maxBodyTest", { dryRun: true }) !== OK
    ) {
      body = this.getMaxBodyNow(Constants.BODY_PROFILE_MINDER);
    }
    return body;
  }

  private getHaulerBody(): BodyPartConstant[] {
    let body = this.getMaxBody(Constants.BODY_PROFILE_HAULER);
    if (
      this.haulers.length <= 0 &&
      this.workers.length <= 0 &&
      this.spawnCreep(body, "maxBodyTest", { dryRun: true }) !== OK
    ) {
      body = this.getMaxBodyNow(Constants.BODY_PROFILE_HAULER);
    }
    return body;
  }

  private spawn(body: BodyPartConstant[], role: string, retiree?: string): ScreepsReturnCode {
    const newName = `${role}_${Game.time.toString(16)}`;
    const memory: CreepMemory = { role };
    if (retiree) {
      memory.retiree = retiree;
    }
    const result = this.spawnCreep(body, newName, { memory });
    CreepUtils.consoleLogIfWatched(
      this,
      ` - spawning: result: ${result}, role: ${role}, body: ${CreepUtils.creepBodyToString(body)}, retiree: ${String(
        retiree
      )}`
    );
    return result;
  }

  private getMaxBody({ profile, seed = [], maxBodyParts = MAX_CREEP_SIZE }: CreepBodyProfile) {
    let body: BodyPartConstant[] = seed.slice();
    let finalBody: BodyPartConstant[] = [];
    const energyCapacity = this.room.energyCapacityAvailable;
    do {
      finalBody = body.slice();
      body = body.concat(profile);
    } while (this.calcBodyCost(body) <= energyCapacity && body.length <= maxBodyParts);
    return finalBody.sort();
  }

  private calcBodyCost(body: BodyPartConstant[]): number {
    return body.map(part => BODYPART_COST[part]).reduce((cost, partCost) => cost + partCost);
  }

  private getMaxBodyNow(bodyProfile: CreepBodyProfile) {
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
      this.spawnCreep(body, "maximizeBody", { dryRun: true }) === 0 &&
      body.length + bodyProfile.profile.length <= bodyProfile.maxBodyParts
    );
    return finalBody.sort();
  }
}
