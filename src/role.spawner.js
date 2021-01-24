var roleSpawner = {

    /** @param {Creep} creeps
     *  @param {string} role 
     *  @param {int} maxCount **/
    breed: function (creeps, role, maxCount) {
        if(creeps.length < maxCount) {
            console.log(role + ': ' + creeps.length + '/' + maxCount);
            var newName = role + Game.time;
            console.log('Spawning new ' + role + ':' + newName);
            Game.spawns['Spawn1'].spawnCreep([WORK,CARRY,MOVE], newName, 
                {memory: {role: role}});
        }

        if(Game.spawns['Spawn1'].spawning) { 
            var spawningCreep = Game.creeps[Game.spawns['Spawn1'].spawning.name];
            Game.spawns['Spawn1'].room.visual.text(
                '🛠️' + spawningCreep.memory.role,
                Game.spawns['Spawn1'].pos.x + 1, 
                Game.spawns['Spawn1'].pos.y, 
                {align: 'left', opacity: 0.8});
        }
    }
}

module.exports = roleSpawner;