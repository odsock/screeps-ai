interface Creep {
    updateJob(job: string): void;
    stopWorkingIfEmpty(): void;
    startWorkingIfFull(message: string): void;
    closestTombstoneWithEnergy: Tombstone | null;
    closestContainerWithEnergy: StructureContainer | null;
    closestRuinsWithEnergy: Ruin | null;
    closestDroppedEnergy: Resource<RESOURCE_ENERGY> | null;
    closestActiveEnergySource: Source | null;
    closestEnergySource: Source | null;
    closestTowerNotFull: StructureTower | null;
    closestSpawnStorageNotFull: StructureSpawn | StructureExtension | null;
}

interface Room {
    constructionSites: ConstructionSite[];
    towers: StructureTower[];
    repairSites: AnyStructure[];
}