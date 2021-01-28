import config from "../constants";

// TODO: avoid using literal 'Spawn1'
// TODO: dynamic body size with ratios of parts instead of full list constant
export class Spawner {
  public static spawnCreeps() {
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

    if (Game.spawns['Spawn1'].spawning) {
      let spawningCreep = Game.creeps[Game.spawns['Spawn1'].spawning.name];
      Game.spawns['Spawn1'].room.visual.text(
        '🛠️' + spawningCreep.memory.role,
        Game.spawns['Spawn1'].pos.x + 1,
        Game.spawns['Spawn1'].pos.y,
        { align: 'left', opacity: 0.8 });
    }
  }

  private static spawnWorker() {
    this.spawnCreep(config.BODY_WORKER, 'worker');
  }

  private static spawnHarvester() {
    this.spawnCreep(config.BODY_HARVESTER, 'harvester');
  }

  private static spawnCreep(body: BodyPartConstant[], role: string): ScreepsReturnCode {
    let newName = 'creep' + Game.time;
    return Game.spawns['Spawn1'].spawnCreep(body, newName, { memory: { role: role } });
  }
}
