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
    let sumX = 0;
    let sumY = 0;
    let roomName = "";
    targets
      .map(t => t.pos)
      .forEach(pos => {
        sumX += pos.x;
        sumY += pos.y;
        roomName = pos.roomName;
      });
    return new RoomPosition(sumX / targets.length, sumY / targets.length, roomName);
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

  /**
   * Get list of store contents sorted by amount
   * Default to getting contents of this creep
   */
  public static getStoreContents(target: RoomObjectWithStorage): ResourceConstant[] {
    const resources: ResourceConstant[] = [];
    for (const resourceName in target.store) {
      const type = resourceName as ResourceConstant;
      if (target.store[type] > 0) {
        resources.push(type);
      }
    }
    return resources.sort((a, b) => target.store[a] - target.store[b]);
  }
}
