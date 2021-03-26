import { RoomWrapper } from "./room-wrapper";
import { CreepUtils } from "creep-utils";
import { Builder } from "roles/builder";
import { Hauler } from "roles/hauler";
import { Upgrader } from "roles/upgrader";
import { Worker } from "roles/worker";
import config from "../constants";
import { Harvester } from "../roles/harvester";

export class SpawnWrapper extends StructureSpawn {
  private readonly workers: Worker[];
  private readonly harvesters: Harvester[];
  private readonly haulers: Hauler[];
  private readonly builders: Builder[];

  private readonly containers: AnyStructure[];
  private readonly rcl: number;
  private readonly upgraders: Upgrader[];
  private readonly roomw: RoomWrapper;

  public constructor(spawn: StructureSpawn) {
    super(spawn.id);
    this.roomw = new RoomWrapper(spawn.room);

    const creeps = this.room.find(FIND_MY_CREEPS);
    this.workers = creeps.filter(c => c.memory.role === "worker").map(c => new Worker(c));
    this.builders = creeps.filter(c => c.memory.role === "builder").map(c => new Builder(c));
    this.harvesters = creeps.filter(c => c.memory.role === "harvester").map(c => new Harvester(c));
    this.upgraders = creeps.filter(c => c.memory.role === "upgarder").map(c => new Upgrader(c));
    this.haulers = creeps.filter(c => c.memory.role === "hauler").map(c => new Hauler(c));
    this.containers = this.room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_CONTAINER });
    this.rcl = this.room.controller?.level ? this.room.controller?.level : 0;
  }

  public spawnCreeps(): void {
    if (!this.spawning) {
      CreepUtils.consoleLogIfWatched(this, `spawn creeps`);
      // spawn harvester for each container
      if (this.harvesters.length < this.getMaxHarvesterCount()) {
        this.spawnHarvester();
        return;
      }
      // TODO: probably hauler numbers should depend on the length of route vs upgrade work speed
      if (this.haulers.length < this.getMaxHaulerCount()) {
        this.spawnHauler();
        return;
      }
      if (this.upgraders.length < this.getMaxUpgraderCount()) {
        this.spawnUpgrader();
        return;
      }
      if (this.workers.length < this.getMaxWorkerCount()) {
        this.spawnWorker();
        return;
      }
      // make builders if there's something to build
      const workPartsNeeded = this.getBuilderWorkPartsNeeded();
      if (this.roomw.constructionSites.length > 0 && workPartsNeeded > 0) {
        this.spawnBuilder(workPartsNeeded);
        return;
      }

      // TODO: write a claimer creep

      // TODO: replace small harvesters early, for faster recovery from attack or mistakes
      // try to replace any aging harvester early
      this.replaceOldHarvesters();
    }

    if (this.spawning) {
      const spawningCreep = Game.creeps[this.spawning.name];
      this.room.visual.text("🛠️" + spawningCreep.memory.role, this.pos.x + 1, this.pos.y, {
        align: "left",
        opacity: 0.8
      });
    }
  }

  private replaceOldHarvesters() {
    for (const creep of this.harvesters) {
      const harvester = new Harvester(creep);
      if (!harvester.spawning && !harvester.memory.retiring === true) {
        CreepUtils.consoleLogIfWatched(this, `- harvester retirement check: ${harvester.name}`);
        const body = this.getHarvesterBody();
        const ticksToSpawn = body.length * CREEP_SPAWN_TIME;
        const pathToReplace = CreepUtils.getPath(this.pos, harvester.pos);
        const ticksToReplace = harvester.calcWalkTime(pathToReplace);
        CreepUtils.consoleLogIfWatched(
          this,
          ` - ticksToLive: ${String(harvester.ticksToLive)}, ticksToSpawn: ${ticksToSpawn}, pathCost: ${ticksToReplace}`
        );
        if (harvester.ticksToLive && harvester.ticksToLive <= ticksToSpawn + ticksToReplace) {
          const result = this.spawnHarvester(harvester.name);
          if (result === OK) {
            harvester.memory.retiring = true;
          }
        }
      }
    }
  }

  private getMaxHaulerCount(): number {
    switch (this.containers.length) {
      case 0:
        return 0;
      case 1:
        return 1;
      default:
        return this.containers.length - 1;
    }
  }

  // TODO: make source continer count dynamic based on memory
  private getMaxHarvesterCount(): number {
    return this.containers.length > 0 ? 1 : 0;
  }

  // TODO: make controller container count dynamic based on memory
  private getMaxUpgraderCount() {
    return this.containers.length > 1 ? 1 : 0;
  }

  private getMaxWorkerCount(): number {
    // make workers in early stages
    if (this.rcl <= 1 || (this.containers.length === 0 && this.harvesters.length === 0)) {
      CreepUtils.consoleLogIfWatched(this, `- max workers: ${config.MAX_WORKERS}`);
      return config.MAX_WORKERS;
    }
    return 0;
  }

  // TODO: this assumes builder profile contains only one work
  private getBuilderBody(workPartsNeeded: number): BodyPartConstant[] {
    const bodyProfile = config.BODY_PROFILE_BUILDER;
    let body = bodyProfile.seed;
    for (let i = 0; i < workPartsNeeded && body.length < bodyProfile.maxBodyParts; i++) {
      body = body.concat(bodyProfile.profile);
    }
    CreepUtils.consoleLogIfWatched(
      this,
      ` - needed ${workPartsNeeded} parts, body: ${CreepUtils.creepBodyToString(body)}`
    );
    return body;
  }

  private getBuilderWorkPartsNeeded() {
    const conWork = this.roomw.constructionWork;
    const activeWorkParts = this.builders.reduce<number>((count: number, creep) => count + creep.countParts(WORK), 0);
    const workPartsNeeded = Math.ceil(conWork / config.WORK_PER_WORKER_PART);
    const workPartsDeficit = workPartsNeeded - activeWorkParts;
    CreepUtils.consoleLogIfWatched(
      this,
      `- calc buider parts needed: ${workPartsNeeded}, active: ${activeWorkParts}, work: ${conWork}`
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
      body = this.getMaxBodyNow(config.BODY_PROFILE_WORKER);
    } else {
      body = this.getMaxBody(config.BODY_PROFILE_WORKER);
    }
    return this.spawn(body, "worker");
  }

  private spawnHarvester(retireeName?: string): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, ` - spawning harvester`);
    const body: BodyPartConstant[] = this.getHarvesterBody();
    return this.spawn(body, "harvester", retireeName);
  }

  private spawnUpgrader(retireeName?: string): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `- spawning upgrader`);
    const body: BodyPartConstant[] = this.getUpgraderBody();
    return this.spawn(body, "harvester", retireeName);
  }

  private spawnHauler(): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `- spawning hauler`);
    const body: BodyPartConstant[] = this.getHaulerBody();
    return this.spawn(body, "hauler");
  }

  private getHarvesterBody(): BodyPartConstant[] {
    let body = this.getMaxBody(config.BODY_PROFILE_HARVESTER);
    if (
      this.harvesters.length <= 0 &&
      this.workers.length <= 0 &&
      this.spawnCreep(body, "maxBodyTest", { dryRun: true }) !== OK
    ) {
      body = this.getMaxBodyNow(config.BODY_PROFILE_HARVESTER);
    }
    return body;
  }

  private getUpgraderBody(): BodyPartConstant[] {
    let body = this.getMaxBody(config.BODY_PROFILE_UPGRADER);
    if (
      this.upgraders.length <= 0 &&
      this.workers.length <= 0 &&
      this.spawnCreep(body, "maxBodyTest", { dryRun: true }) !== OK
    ) {
      body = this.getMaxBodyNow(config.BODY_PROFILE_UPGRADER);
    }
    return body;
  }

  private getHaulerBody(): BodyPartConstant[] {
    let body = this.getMaxBody(config.BODY_PROFILE_HAULER);
    if (
      this.haulers.length <= 0 &&
      this.workers.length <= 0 &&
      this.spawnCreep(body, "maxBodyTest", { dryRun: true }) !== OK
    ) {
      body = this.getMaxBodyNow(config.BODY_PROFILE_HAULER);
    }
    return body;
  }

  private spawn(body: BodyPartConstant[], role: string, retiree?: string): ScreepsReturnCode {
    const newName = `${role} ${Game.time}`;
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
    CreepUtils.consoleLogIfWatched(this, ` - max body: ${CreepUtils.creepBodyToString(finalBody)}`);
    return finalBody;
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
    CreepUtils.consoleLogIfWatched(this, ` - max body now: ${CreepUtils.creepBodyToString(finalBody)}`);
    return finalBody;
  }
}
