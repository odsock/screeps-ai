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

    // let harvesters = _.filter(Game.creeps, (creep) => creep.memory.role == 'harvester');
    // RoleSpawner.breed(harvesters, 'harvester', 1);

    // let upgraders = _.filter(Game.creeps, (creep) => creep.memory.role == 'upgrader');
    // RoleSpawner.breed(upgraders, 'upgrader', 6);

    // let builders = _.filter(Game.creeps, (creep) => creep.memory.role == 'builder');
    // RoleSpawner.breed(builders, 'builder', 1);

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

    // TODO: dynamic body size with ratios of parts instead of full list constant
    private spawnWorker() {
      let body = config.BODY_WORKER;
      this.spawnCreep(body, 'worker');
    }

    private spawnHarvester() {
      this.spawnCreep(config.BODY_HARVESTER, 'harvester');
    }

    private spawnCreep(body: BodyPartConstant[], role: string): ScreepsReturnCode {
      let newName = 'creep' + Game.time;
      return this.spawn.spawnCreep(body, newName, { memory: { role: role } });
  }
}
