import { CreepUtils } from "creep-utils";
import config from "../constants";

export class Spawner {
  private readonly spawn: StructureSpawn;
  private readonly harvesters: Creep[];
  private readonly haulers: Creep[];
  private readonly containers: AnyStructure[];
  private readonly workers: Creep[];

  constructor(spawn: StructureSpawn) {
    this.spawn = spawn;

    this.workers = _.filter(Game.creeps, (creep) => creep.memory.role == 'worker');
    this.harvesters = this.spawn.room.find(FIND_MY_CREEPS, { filter: (c) => c.memory.role == 'harvester' });
    this.haulers = this.spawn.room.find(FIND_MY_CREEPS, { filter: (c) => c.memory.role == 'hauler' });
    this.containers = this.spawn.room.find(FIND_STRUCTURES, { filter: (s) => s.structureType == STRUCTURE_CONTAINER });
  }

  public spawnCreeps() {
    if (!this.spawn.spawning) {
      // HACK: find a better way to decide worker count
      if (this.workers.length < this.getMaxWorkerCount()) {
        CreepUtils.consoleLogIfWatched(this.spawn, `${this.workers.length}/${config.MAX_CREEPS}`);
        this.spawnWorker();
      }
      // spawn harvester for each container
      if (this.harvesters.length < this.getMaxHarvesterCount()) {
        this.spawnHarvester();
      }
      // TODO: probably hauler numbers should depend on the length of route vs upgrade work speed
      if (this.haulers.length < this.getMaxHaulerCount()) {
        this.spawnHauler();
      }

      // try to replace any aging harvester early
      for (let i = 0; i < this.harvesters.length; i++) {
        const harvester = this.harvesters[i];
        if (!harvester.spawning && !harvester.memory.retiring == true) {
          const body = this.getHarvesterBody();
          const ticksToSpawn = body.length * 3;
          const pathToReplace = PathFinder.search(this.spawn.pos, harvester.pos);
          CreepUtils.consoleLogIfWatched(this.spawn, `harvester spawn: ticksToLive: ${harvester.ticksToLive}, ticksToSpawn: ${ticksToSpawn}, pathCost: ${pathToReplace.cost}`);
          if (harvester.ticksToLive && harvester.ticksToLive <= ticksToSpawn + pathToReplace.cost) {
            const result = this.spawnHarvester(harvester.name);
            if (result == OK) {
              harvester.memory.retiring = true;
            }
          }
        }
      }
    }

    if (this.spawn.spawning) {
      let spawningCreep = Game.creeps[this.spawn.spawning.name];
      this.spawn.room.visual.text(
        '🛠️' + spawningCreep.memory.role,
        this.spawn.pos.x + 1,
        this.spawn.pos.y,
        { align: 'left', opacity: 0.8 });
    }
  }

  private getMaxHaulerCount(): number {
    return this.containers.length - 1;
  }

  private getMaxHarvesterCount(): number {
    return this.containers.length;
  }

  private getMaxWorkerCount(): number {
    return config.MAX_CREEPS - this.haulers.length;
  }

  private spawnWorker(): ScreepsReturnCode {
    const profile = config.BODY_PROFILE_WORKER;
    let body: BodyPartConstant[];
    if (this.workers.length <= 0) {
      body = this.getMaxBodyNow(profile);
    }
    else {
      body = this.getMaxBody(profile);
    }
    return this.spawnCreep(body, 'worker');
  }

  private spawnHarvester(retireeName?: string): ScreepsReturnCode {
    let body: BodyPartConstant[] = this.getHarvesterBody();
    return this.spawnCreep(body, 'harvester', retireeName);
  }

  private spawnHauler(): ScreepsReturnCode {
    let body: BodyPartConstant[] = this.getHaulerBody();
    return this.spawnCreep(body, 'hauler');
  }

  private getHarvesterBody(): BodyPartConstant[] {
    const profile = config.BODY_PROFILE_HARVESTER;
    let body: BodyPartConstant[] = this.getMaxBody(profile, [MOVE, CARRY]);
    return body;
  }

  private getHaulerBody(): BodyPartConstant[] {
    const profile = config.BODY_PROFILE_HAULER;
    let body: BodyPartConstant[] = this.getMaxBody(profile);
    return body;
  }

  private spawnCreep(body: BodyPartConstant[], role: string, retiree?: string): ScreepsReturnCode {
    let newName = role + Game.time;
    let memory: CreepMemory = { role: role };
    if (retiree) {
      memory.retiree = retiree;
    }
    let result = this.spawn.spawnCreep(body, newName, { memory: memory });
    console.log(`spawn result: ${result}`);
    return result;
  }

  private getMaxBody(profile: BodyPartConstant[], seed: BodyPartConstant[] = []) {
    let body: BodyPartConstant[] = seed.slice();
    let finalBody: BodyPartConstant[] = [];
    let energyCapacity = this.spawn.room.energyCapacityAvailable;
    do {
      finalBody = body.slice();
      body = body.concat(profile);
    } while (this.calcBodyCost(body) <= energyCapacity);
    return finalBody;
  }

  private calcBodyCost(body: BodyPartConstant[]): number {
    return body.map((part) => BODYPART_COST[part])
      .reduce((cost, partCost) => cost + partCost);
  }

  private getMaxBodyNow(profile: BodyPartConstant[], seed: BodyPartConstant[] = []) {
    let body: BodyPartConstant[] = seed.slice();
    let finalBody: BodyPartConstant[] = [];
    do {
      finalBody = body.slice();
      body = body.concat(profile);
    } while (this.spawn.spawnCreep(body, 'maximizeBody', { dryRun: true }) == 0);
    return finalBody;
  }
}
