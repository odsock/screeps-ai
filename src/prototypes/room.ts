Object.defineProperty(Room, 'constructionSites', {
    get() {
        return this.find(FIND_CONSTRUCTION_SITES);
    }
});

Object.defineProperty(Room, 'towers', {
    get() {
        return this.find(FIND_MY_STRUCTURES, { filter: (structure: AnyOwnedStructure) => structure.structureType == STRUCTURE_TOWER })  as StructureTower[];
    }
});

Object.defineProperty(Room, 'repairSites', {
    get() {
        return this.find(FIND_STRUCTURES, { filter: (structure: AnyStructure) => structure.hits < structure.hitsMax }) as AnyStructure[];
    }
});