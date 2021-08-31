import { CreepUtils } from "creep-utils";
export class SpawnWrapper extends StructureSpawn {
  public constructor(spawn: StructureSpawn) {
    super(spawn.id);
  }

  public spawn(body: BodyPartConstant[], role: string, retiree?: string): ScreepsReturnCode {
    const newName = `${role}_${Game.time.toString(16)}`;
    const memory: CreepMemory = { role };
    if (retiree) {
      memory.retiree = retiree;
    }
    const result = this.spawnCreep(body, newName, { memory });
    CreepUtils.consoleLogIfWatched(this, `spawning: ${role} ${CreepUtils.creepBodyToString(body)}`, result);
    if (result === ERR_INVALID_ARGS) {
      console.log(`Invalid spawn: ${role} ${CreepUtils.creepBodyToString(body)}`)
    }
    return result;
  }
}
