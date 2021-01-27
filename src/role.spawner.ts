import config from "./constants";

// TODO: avoid using literal 'Spawn1'
export class RoleSpawner {
  public static spawnCreeps() {
    if(_.size(Game.creeps) < config.MAX_CREEPS) {
      // let workers = _.filter(Game.creeps, (creep) => creep.memory.role == 'worker');
      RoleSpawner.spawnWorker();

      // let harvesters = _.filter(Game.creeps, (creep) => creep.memory.role == 'harvester');
      // RoleSpawner.breed(harvesters, 'harvester', 1);

      // let upgraders = _.filter(Game.creeps, (creep) => creep.memory.role == 'upgrader');
      // RoleSpawner.breed(upgraders, 'upgrader', 6);

      // let builders = _.filter(Game.creeps, (creep) => creep.memory.role == 'builder');
      // RoleSpawner.breed(builders, 'builder', 1);
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

  private static spawnCreep(body: BodyPartConstant[], role: string): ScreepsReturnCode {
    let newName = 'creep' + Game.time;
    return Game.spawns['Spawn1'].spawnCreep(body, newName, { memory: { role: role } });
  }
}
