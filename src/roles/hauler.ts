export class Hauler {
    constructor(private readonly creep: Creep) { }

    private findControllerContainer(): StructureContainer | null {
        if (this.creep.room.controller) {
            const containers = this.creep.room.controller.pos.findInRange(FIND_STRUCTURES, 3, { filter: (s) => s.structureType == STRUCTURE_CONTAINER });
            if(containers.length > 0) {
                return containers as StructureContainer[];
            }
        }
        return null;
    }
}