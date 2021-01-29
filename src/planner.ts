export class Planner {
    private readonly room: Room;

    public constructor(room: Room) {
        this.room = room;
    }

    public planControllerRoads() {
        if(this.room.memory.controllerRoadsComplete == true) {
            return OK;
        }

        if(this.room.controller) {
            let controller = this.room.controller;
            let sources = this.room.find(FIND_SOURCES);
            for(let source in sources) {
                let path = PathFinder.search(sources[source].pos, {pos: controller.pos, range: 3}, {swampCost: 1});
                this.room.visual.poly(path.path, { stroke: '#00ff00' });
                if(path.incomplete) {
                    console.log(`road plan incomplete: ${sources[source].pos} -> ${controller.pos}`);
                    return ERR_NO_PATH;
                }

                for(let pos in path.path){
                    let result = this.room.createConstructionSite(path.path[pos], STRUCTURE_ROAD);
                    if(result != 0) {
                        console.log(`road failed: ${result}`);
                        return result;
                    }
                }
                this.room.memory.controllerRoadsComplete = true;
                return OK;
            }
            return OK;
        }
        return OK;
    }
}