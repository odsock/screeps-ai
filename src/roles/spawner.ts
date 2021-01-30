import config from "../constants";

export class Spawner {
  private spawn: StructureSpawn;

  constructor(spawn: StructureSpawn) {
    this.spawn = spawn;
  }

  public spawnCreeps() {
    let workers = _.filter(Game.creeps, (creep) => creep.memory.role == 'worker');
    if (workers.length <= 1) {
      this.spawnWorker();
    }
    else if (workers.length < config.MAX_CREEPS) {
      this.spawnMaxWorker();
    }

    // spawn harvester for each container
    if (!this.spawn.spawning) {
      let harvesters = this.spawn.room.find(FIND_MY_CREEPS, { filter: (c) => c.memory.role == 'harvester' });
      let containers = this.spawn.room.find(FIND_STRUCTURES, { filter: (s) => s.structureType == STRUCTURE_CONTAINER });
      if (harvesters.length < containers.length) {
        this.spawnHarvester();
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

  private spawnMaxWorker() {
    const profile = config.BODY_PROFILE_WORKER;
    let body: BodyPartConstant[] = this.getMaxBody(profile);
    this.spawnCreep(body, 'worker');
  }

  private spawnWorker() {
    const profile = config.BODY_PROFILE_WORKER;
    let body: BodyPartConstant[] = this.getMaxBodyNow(profile);
    this.spawnCreep(body, 'worker');
  }

  private spawnHarvester() {
    const profile = config.BODY_PROFILE_HARVESTER;
    let body: BodyPartConstant[] = this.getMaxBodyNow(profile, [MOVE]);
    this.spawnCreep(body, 'harvester');
  }

  private spawnCreep(body: BodyPartConstant[], role: string): ScreepsReturnCode {
    let newName = 'creep' + Game.time;
    let result = this.spawn.spawnCreep(body, newName, { memory: { role: role } });
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
    } while (this.calcBodyCost(body) < energyCapacity);
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
