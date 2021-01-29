import config from "../constants";

export class Spawner {
  private spawn: StructureSpawn;

  constructor(spawn: StructureSpawn) {
    this.spawn = spawn;
  }

  public spawnCreeps() {
    let workers = _.filter(Game.creeps, (creep) => creep.memory.role == 'worker');
    if (workers.length < config.MAX_CREEPS) {
      this.spawnWorker();
    }

    // spawn harvester for each container
    for (const spawnName in Game.spawns) {
      let spawn = Game.spawns[spawnName];
      let harvesters = spawn.room.find(FIND_MY_CREEPS, { filter: (c) => c.memory.role == 'harvester' });
      let containers = spawn.room.find(FIND_STRUCTURES, { filter: (s) => s.structureType == STRUCTURE_CONTAINER });
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

  private spawnWorker() {
    const profile = config.BODY_PROFILE_WORKER;
    let body: BodyPartConstant[] = this.maximizeBody(profile);
    this.spawnCreep(body, 'worker');
  }

  // TODO: dynamic body size with ratios of parts instead of full list constant
  private spawnHarvester() {
    const profile = config.BODY_PROFILE_HARVESTER;
    let body: BodyPartConstant[] = this.maximizeBody(profile, [MOVE]);
    this.spawnCreep(body, 'harvester');
  }

  private spawnCreep(body: BodyPartConstant[], role: string): ScreepsReturnCode {
    let newName = 'creep' + Game.time;
    let result = this.spawn.spawnCreep(body, newName, { memory: { role: role } });
    console.log(`spawn result: ${result}`);
    return result;
  }

  private maximizeBody(profile: BodyPartConstant[], seed: BodyPartConstant[] = []) {
    let body: BodyPartConstant[] = seed.slice();
    let finalBody: BodyPartConstant[] = [];
    let result: ScreepsReturnCode;
    do {
      finalBody = body.slice();
      body = body.concat(profile);
      console.log(`testing body: ${body}`);
      result = this.spawn.spawnCreep(body, 'maximizeBody', { dryRun: true });
      console.log(`test result: ${result}`);
    } while (result == 0);
    console.log(`final body: ${finalBody}`);
    return finalBody;
  }
}
