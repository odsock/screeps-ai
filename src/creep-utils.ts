import { CreepWrapper } from "roles/creep-wrapper";
import { SockPuppetConstants } from "./config/sockpuppet-constants";

export interface Watchable {
  name: string;
  memory: { watched?: boolean; profile?: boolean };
}

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

  public static log(logLevel: LogLevel, message: string): void {
    if (logLevel >= global.LOG_LEVEL) {
      console.log(`${logLevel.toString()}: ${message}`);
    }
  }

  public static consoleLogIfWatched(
    watchable: Watchable,
    message: string,
    result: ScreepsReturnCode | undefined = undefined,
    logLevel: LogLevel = INFO
  ): void {
    if (logLevel >= global.LOG_LEVEL && watchable.memory.watched === true) {
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
  public static countParts(type: BodyPartConstant, ...creeps: Creep[] | CreepWrapper[]): number {
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
   */
  public static getStoreContents(store: StoreDefinition): ResourceConstant[] {
    const resources: ResourceConstant[] = [];
    for (const resourceName in store) {
      const type = resourceName as ResourceConstant;
      if (store[type] > 0) {
        resources.push(type);
      }
    }
    return resources.sort((a, b) => store[a] - store[b]);
  }

  public static getClosestExitDirection(pos: RoomPosition): DirectionConstant | undefined {
    const exitPos = pos.findClosestByRange(FIND_EXIT);
    if (!exitPos) {
      return undefined;
    }
    let exitDir = pos.getDirectionTo(exitPos);
    if (!exitDir) {
      if (pos.x === 0) exitDir = LEFT;
      if (pos.y === 0) exitDir = TOP;
      if (pos.x === 49) exitDir = RIGHT;
      if (pos.y === 49) exitDir = BOTTOM;
    }
    return exitDir;
  }

  public static reverseDirection(dir: DirectionConstant): DirectionConstant {
    return ((dir + 4) % 8) as DirectionConstant;
  }

  public static findOldestCreep(creeps: Creep[]): Creep | undefined {
    return creeps.reduce((oldest: Creep | undefined, c) => {
      if (!oldest || (c.ticksToLive && oldest.ticksToLive && c.ticksToLive < oldest.ticksToLive)) {
        return c;
      }
      return oldest;
    }, undefined);
  }
}
