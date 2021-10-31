import { profile } from "../screeps-typescript-profiler";
import { SockPuppetConstants } from "./config/sockpuppet-constants";

export interface Watchable {
  name: string;
  [key: string]: any;
  memory: { watched?: boolean; profile?: boolean };
}

@profile
export class CreepUtils {
  public static averagePos(targets: { pos: RoomPosition }[]): RoomPosition {
    if (targets.length === 1) {
      return targets[0].pos;
    }
    const average = targets
      .map(t => t.pos)
      .reduce((avg, pos) => {
        avg.x += pos.x;
        avg.y += pos.y;
        return avg;
      });
    return new RoomPosition(average.x / targets.length, average.y / targets.length, average.roomName);
  }

  public static consoleLogIfWatched(
    watchable: Watchable,
    message: string,
    result: ScreepsReturnCode | undefined = undefined
  ): void {
    if (watchable.memory.watched === true) {
      if (result !== undefined) {
        const resultString = String(SockPuppetConstants.ERROR_CODE_LOOKUP.get(result));
        console.log(`${watchable.name}: ${message}: ${result} ${resultString}`);
      } else {
        console.log(`${watchable.name}: ${message}`);
      }
    }
  }

  public static creepBodyToString(body: BodyPartConstant[]): string {
    const counts = _.countBy(body);
    let returnValue = "";
    for (const key in counts) {
      returnValue = `${returnValue}${key[0]}${counts[key]}`;
    }
    return returnValue;
  }

  public static getEnergyStoreRatioFree(structure: StructureWithStorage): number {
    const freeCap = structure.store.getFreeCapacity(RESOURCE_ENERGY);
    const totalCap = structure.store.getCapacity(RESOURCE_ENERGY);
    if (freeCap && totalCap) {
      return freeCap / totalCap;
    } else {
      return 0;
    }
  }

  /** counts creep body parts matching specified type */
  public static countParts(type: BodyPartConstant, ...creeps: Creep[]): number {
    return creeps.reduce<number>((count, creep) => {
      return count + creep.body.filter(part => part.type === type).length;
    }, 0);
  }

  private static findCentroid = (
    centroid: { x: number; y: number },
    pos: RoomPosition,
    index: number,
    set: RoomPosition[]
  ): { x: number; y: number } => {
    centroid.x += pos.x / set.length;
    centroid.y += pos.y / set.length;
    return centroid;
  };
}
