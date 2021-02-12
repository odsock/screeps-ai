import { CreepUtils } from "creep-utils";
import config from "../constants";

export class Spawner {
  private spawn: StructureSpawn;

  constructor(spawn: StructureSpawn) {
    this.spawn = spawn;
  }

  public spawnCreeps() {
    if (!this.spawn.spawning) {
      this.spawnWorker();

      // spawn harvester for each container
      let harvesters = this.spawn.room.find(FIND_MY_CREEPS, { filter: (c) => c.memory.role == 'harvester' });
      let haulers = this.spawn.room.find(FIND_MY_CREEPS, { filter: (c) => c.memory.role == 'hauler' });
      let containers = this.spawn.room.find(FIND_STRUCTURES, { filter: (s) => s.structureType == STRUCTURE_CONTAINER });
      if (harvesters.length < containers.length) {
        this.spawnHarvester();
      }
      // TODO: probably hauler numbers should depend on the length of route vs upgrade work speed
      if (haulers.length < containers.length - 1) {
        this.spawnHauler();
      }

      // try to replace any aging harvester early
      for (let i = 0; i < harvesters.length; i++) {
        const harvester = harvesters[i];
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

  private spawnWorker(): ScreepsReturnCode {
    let workers = _.filter(Game.creeps, (creep) => creep.memory.role == 'worker');
    CreepUtils.consoleLogIfWatched(this.spawn, `${workers.length}/${config.MAX_CREEPS}`);
    if (workers.length < config.MAX_CREEPS) {
      const profile = config.BODY_PROFILE_WORKER;
      let body: BodyPartConstant[];
      if (workers.length <= 1) {
        body = this.getMaxBodyNow(profile);
      }
      else {
        body = this.getMaxBody(profile);
      }
      return this.spawnCreep(body, 'worker');
    }
    return OK;
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
