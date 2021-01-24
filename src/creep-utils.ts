var creepUtils = {

    harvest: function(creep: Creep) {
        var sources = creep.room.find(FIND_SOURCES);
        if(creep.harvest(sources[0]) == ERR_NOT_IN_RANGE) {
            creep.moveTo(sources[0], {visualizePathStyle: {stroke: '#ffaa00'}});
        }
    }

    // harvestQueue: function(creep: Creep) {
    //     console.log('##START HARVEST: ' + creep.name);
    //     var sources = creep.room.find(FIND_SOURCES);
    //     if(creep.harvest(sources[0]) == ERR_NOT_IN_RANGE) {
    //         var pos = this.enterEnergyQueue(creep);
    //         console.log(`pos: ${pos.x},${pos.y}`);
    //         var result = creep.moveTo(pos.x, pos.y, {visualizePathStyle: {stroke: '#ffaa00'}});
    //         console.log(`${creep.name}: move result: ${result}`);
    //     }
    //     else if(creep.store.getFreeCapacity() == 0) {
    //         this.leaveEnergyQueue(creep);
    //     }
    //     console.log('##END HARVEST ' + creep.name);
    // },

    // /** @param {Creep} creep The Harvesting creep **/
    // enterEnergyQueue: function(creep: Creep) {
    //     console.log('entering queue');
    //     var headFlag = Game.flags['EnergyQueueHead'];
    //     var queue = headFlag.memory.queue;
    //     if (!queue || queue.length > 10) {
    //         queue = [];
    //         headFlag.memory.queue = queue;
    //     }
    //     console.log(queue);

    //     var index = queue.indexOf(creep);
    //     console.log(`queued at: ${creep.name}`);
    //     if (index == -1) {
    //         index = queue.push(creep);
    //         console.log(`pushed: ${creep.name}, index: ${index}`);
    //     }
    //     else {
    //         console.log(`queued at: ${creep.name}`);
    //     }
    //     console.log(`${creep.name} queue index: ${index}`);

    //     return { x: headFlag.pos.x - index, y: headFlag.pos.y };
    // },

    // /** @param {Creep} creep The Harvesting creep **/
    // leaveEnergyQueue: function(creep: Creep) {
    //     var headFlag = Game.flags['EnergyQueueHead'];
    //     var queue = headFlag.memory.queue;

    //     queue.remove(creep);
    // }
}

module.exports = creepUtils;
