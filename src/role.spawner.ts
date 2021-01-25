export class RoleSpawner {
    public static breed(creeps: Creep[], role: string, maxCount: number) {
        if (creeps.length < maxCount) {
            let newName = 'creep' + Game.time;
            console.log(role + ': ' + creeps.length + '/' + maxCount + '. Spawning:' + newName);
            let result = Game.spawns['Spawn1'].spawnCreep([WORK, CARRY, MOVE], newName, {memory: {role: role}});
            console.log('Result: ' + result.toString());
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
}
