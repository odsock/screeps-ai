export class Planner {
    private readonly room: Room;

    public constructor(room: Room) {
        this.room = room;
    }

    public planControllerRoads() {
        if(this.room.controller) {
            let controller = this.room.controller;
            let sources = this.room.find(FIND_SOURCES);
            for(let source in sources) {
                let path = PathFinder.search(sources[source].pos, {pos: controller.pos, range: 3});
                this.room.visual.poly(path.path, { stroke: '#00ff00' });
            }
        }
    }
}