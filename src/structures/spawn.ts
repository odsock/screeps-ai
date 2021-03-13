import { CreepUtils } from "creep-utils";
import config from "../constants";
import { Harvester } from "../roles/harvester";

export class Spawn extends StructureSpawn {
  private readonly workers: Creep[];
  private readonly harvesters: Creep[];
  private readonly haulers: Creep[];
  private readonly containers: AnyStructure[];
  private readonly rcl: number;

  constructor(spawn: StructureSpawn) {
    super(spawn.id);

    const creeps = this.room.find(FIND_MY_CREEPS);
    this.workers = creeps.filter((c) => c.memory.role == 'worker');
    this.harvesters = creeps.filter((c) => c.memory.role == 'harvester');
    this.haulers = creeps.filter((c) => c.memory.role == 'hauler');
    this.containers = this.room.find(FIND_STRUCTURES, { filter: (s) => s.structureType == STRUCTURE_CONTAINER });
    this.rcl = this.room.controller?.level ? this.room.controller?.level : 0;
  }

  public spawnCreeps() {
    if (!this.spawning) {
      // spawn harvester for each container
      if (this.harvesters.length < this.getMaxHarvesterCount()) {
        this.spawnHarvester();
      }
      // TODO: probably hauler numbers should depend on the length of route vs upgrade work speed
      if (this.haulers.length < this.getMaxHaulerCount()) {
        this.spawnHauler();
      }
      if (this.workers.length < this.getMaxWorkerCount()) {
        this.spawnWorker();
      }

      // TODO: write a claimer creep

      // TODO: replace small harvesters early, for faster recovery from attack or mistakes
      // try to replace any aging harvester early
      this.replaceOldHarvesters();
    }

    if (this.spawning) {
      let spawningCreep = Game.creeps[this.spawning.name];
      this.room.visual.text(
        '🛠️' + spawningCreep.memory.role,
        this.pos.x + 1,
        this.pos.y,
        { align: 'left', opacity: 0.8 });
    }
  }

  private replaceOldHarvesters() {
    for (let i = 0; i < this.harvesters.length; i++) {
      const harvester = new Harvester(this.harvesters[i]);
      if (!harvester.spawning && !harvester.memory.retiring == true) {
        const body = this.getHarvesterBody();
        const ticksToSpawn = body.length * CREEP_SPAWN_TIME;
        const pathToReplace = CreepUtils.getPath(this.pos, harvester.pos);
        const ticksToReplace = harvester.calcWalkTime(pathToReplace);
        CreepUtils.consoleLogIfWatched(this, `harvester spawn: ticksToLive: ${harvester.ticksToLive}, ticksToSpawn: ${ticksToSpawn}, pathCost: ${ticksToReplace}`);
        if (harvester.ticksToLive && harvester.ticksToLive <= ticksToSpawn + ticksToReplace) {
          const result = this.spawnHarvester(harvester.name);
          if (result == OK) {
            harvester.memory.retiring = true;
          }
        }
      }
    }
  }

  private getMaxHaulerCount(): number {
    return this.containers.length - 1;
  }

  private getMaxHarvesterCount(): number {
    return this.containers.length;
  }

  private getMaxWorkerCount(): number {
    // make workers in early stages
    if (this.rcl <= 1) {
      CreepUtils.consoleLogIfWatched(this, `low rcl, max workers: ${config.MAX_WORKERS}`);
      return config.MAX_WORKERS;
    }

    // make workers if there's something to build
    const conWork = this.room.find(FIND_MY_CONSTRUCTION_SITES)
      .reduce<number>((work: number, site) => { return work + site.progressTotal - site.progress }, 0);
    if (conWork > 0) {
      const calculatedMaxWorkers = conWork / config.WORK_PER_WORKER;
      const maxWorkers = calculatedMaxWorkers < config.MAX_WORKERS ? calculatedMaxWorkers : config.MAX_WORKERS;
      const finalMaxWorkers = Math.ceil(maxWorkers);
      CreepUtils.consoleLogIfWatched(this, `work: ${conWork}, calc max workers: ${calculatedMaxWorkers}, final max workers: ${finalMaxWorkers}`);
      return finalMaxWorkers;
    }

    return 0;
  }

  private spawnWorker(): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `spawning worker`);
    const profile = config.BODY_PROFILE_WORKER;
    let body: BodyPartConstant[];
    if (this.workers.length < 1) {
      body = this.getMaxBodyNow({ profile });
    }
    else {
      body = this.getMaxBody({ profile });
    }
    return this.spawn(body, 'worker');
  }

  private spawnHarvester(retireeName?: string): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `spawning harvester`);
    let body: BodyPartConstant[] = this.getHarvesterBody();
    return this.spawn(body, 'harvester', retireeName);
  }

  private spawnHauler(): ScreepsReturnCode {
    CreepUtils.consoleLogIfWatched(this, `spawning hauler`);
    let body: BodyPartConstant[] = this.getHaulerBody();
    return this.spawn(body, 'hauler');
  }

  private getHarvesterBody(): BodyPartConstant[] {
    const profile = config.BODY_PROFILE_HARVESTER;
    let body = this.getMaxBody({ profile: profile, seed: [MOVE, CARRY], maxBodyParts: 10 });
    if (this.harvesters.length <= 0 && this.workers.length <= 0 && this.spawnCreep(body, 'maxBodyTest', { dryRun: true }) != OK) {
      body = this.getMaxBodyNow({ profile: profile, seed: [MOVE, CARRY], maxBodyParts: 10 });
    }
    return body;
  }

  private getHaulerBody(): BodyPartConstant[] {
    const profile = config.BODY_PROFILE_HAULER;
    let body = this.getMaxBody({ profile: profile, maxBodyParts: 30 });
    if (this.haulers.length <= 0 && this.workers.length <= 0 && this.spawnCreep(body, 'maxBodyTest', { dryRun: true }) != OK) {
      body = this.getMaxBodyNow({ profile: profile });
    }
    return body;
  }

  private spawn(body: BodyPartConstant[], role: string, retiree?: string): ScreepsReturnCode {
    let newName = role + Game.time;
    let memory: CreepMemory = { role: role };
    if (retiree) {
      memory.retiree = retiree;
    }
    CreepUtils.consoleLogIfWatched(this, `spawning body: ${body}, role: ${role}, retiree: ${retiree}`);
    let result = this.spawnCreep(body, newName, { memory: memory });
    console.log(`spawn result: ${result}`);
    return result;
  }

  private getMaxBody({ profile, seed = [], maxBodyParts = MAX_CREEP_SIZE }: { profile: BodyPartConstant[]; seed?: BodyPartConstant[]; maxBodyParts?: number; }) {
    CreepUtils.consoleLogIfWatched(this, `get max body`);
    let body: BodyPartConstant[] = seed.slice();
    let finalBody: BodyPartConstant[] = [];
    let energyCapacity = this.room.energyCapacityAvailable;
    do {
      finalBody = body.slice();
      body = body.concat(profile);
    } while (this.calcBodyCost(body) <= energyCapacity && body.length <= maxBodyParts);
    CreepUtils.consoleLogIfWatched(this, `final body: ${finalBody}`);
    return finalBody;
  }

  private calcBodyCost(body: BodyPartConstant[]): number {
    return body.map((part) => BODYPART_COST[part])
      .reduce((cost, partCost) => cost + partCost);
  }

  private getMaxBodyNow({ profile, seed = [], maxBodyParts = MAX_CREEP_SIZE }: { profile: BodyPartConstant[]; seed?: BodyPartConstant[]; maxBodyParts?: number }) {
    CreepUtils.consoleLogIfWatched(this, `get max body now`)
    // first make body at as large as possible under 300 spawn energy
    let body = seed.slice();
    let finalBody: BodyPartConstant[] = [];
    do {
      finalBody = body.slice();
      body = body.concat(profile);
    } while (this.calcBodyCost(body) < SPAWN_ENERGY_CAPACITY);

    // grow body until all available energy is used
    do {
      finalBody = body.slice();
      body = body.concat(profile);
    } while (
      this.spawnCreep(body, 'maximizeBody', { dryRun: true }) == 0
      && body.length + profile.length <= maxBodyParts
    );
    CreepUtils.consoleLogIfWatched(this, `final body: ${finalBody}`);
    return finalBody;
  }
}
