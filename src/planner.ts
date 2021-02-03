import { StructurePlan } from "structure-plan";
import myconstants from "./constants";

export class Planner {
  private readonly room: Room;
  private readonly terrain: RoomTerrain;

  private readonly MAX_DISTANCE = 99999;

  public constructor(room: Room) {
    this.room = room;
    this.terrain = this.room.getTerrain();
  }

  public placeControllerRoads(): ScreepsReturnCode {
    if (this.room.controller && this.room.memory.controllerRoads != true) {
      this.room.memory.controllerRoads = true;
      const controller = this.room.controller;
      const sources = this.room.find(FIND_SOURCES);
      for (let i = 0; i < sources.length; i++) {
        const path = this.planRoad(sources[i].pos, controller.pos, 3)
        if (!path.incomplete) {
          this.placeRoad(path);
        }
        else {
          this.room.memory.controllerRoads = false;
        }
      }
    }
    return OK;
  }

  public placeRoad(path: PathFinderPath): void {
    path.path.forEach((pos) => {
      const result = this.room.createConstructionSite(pos, STRUCTURE_ROAD);
      if (result != 0) {
        console.log(`road failed: ${result}, pos: ${pos}`);
      }
    });
  }

  public planRoad(origin: RoomPosition, goal: RoomPosition, range = 0): PathFinderPath {
    const path = PathFinder.search(origin, { pos: goal, range: range }, { swampCost: 2, plainCost: 2, roomCallback: this.getCostMatrix });
    this.room.visual.poly(path.path, { stroke: '#00ff00' });
    if (path.incomplete) {
      console.log(`road plan incomplete: ${origin} -> ${goal}`);
    }
    return path;
  }

  // TODO: plan roads around extensions
  public planExtensionRoads() {
    if (this.room.memory.extensionRoads != true) {
      console.log(`calling room: ${this.room.name}`);
      const extensions = this.room.find(FIND_MY_STRUCTURES, { filter: (s) => s.structureType == STRUCTURE_EXTENSION });
      const sources = this.room.find(FIND_SOURCES);
      for (let i = 0; i < sources.length; i++) {
        for (let j = 0; i < extensions.length; i++) {
          const path = this.planRoad(sources[i].pos, extensions[j].pos, 1);
          if (!path.incomplete) {
            this.placeRoad(path);
          }
        }
      }
      this.room.memory.extensionRoads = true;
    }
  }

  public getCostMatrix(roomName: string): CostMatrix | boolean {
    console.log(`roomName: ${roomName}`);
    const room = Game.rooms[roomName];
    if (!room) return false;
    let cost = new PathFinder.CostMatrix();
    room.find(FIND_STRUCTURES).forEach((s) => {
      if (s.structureType == STRUCTURE_ROAD) {
        cost.set(s.pos.x, s.pos.y, 1);
      }
      else if (s.structureType !== STRUCTURE_CONTAINER && (s.structureType !== STRUCTURE_RAMPART || !s.my)) {
        cost.set(s.pos.x, s.pos.y, 0xff);
      }
    });
    return cost;
  }

  // // TODO: plan extension placement
  public planExtensionGroup() {
    const conLevel = this.room.controller?.level;
    if (conLevel) {
      const maxExtens = CONTROLLER_STRUCTURES.extension[conLevel];
      const builtExtens = this.room.find(FIND_MY_STRUCTURES, { filter: (s) => s.structureType === STRUCTURE_EXTENSION }).length;
      const availExtens = maxExtens - builtExtens;
      if (availExtens >= 5) {
        const structurePlan = this.findSiteForPattern(myconstants.STRUCTURE_PLAN_EXTENSION_GROUP);
        if (structurePlan.plan.length > 0) {
          console.log(`draw site: ${structurePlan.plan[0].x}, ${structurePlan.plan[0].y}`);
          const visual = this.room.visual.poly(structurePlan.plan);
        }
      }
    }
  }

  private findSiteForPattern(pattern: StructurePlanPosition[]): StructurePlan {
    const structurePlan = new StructurePlan(pattern);
    const patternWidth = structurePlan.getWidth();
    const patternHeight = structurePlan.getHeight();
    const searchWidth = myconstants.ROOM_SIZE - 1 - patternWidth;
    const searchHeight = myconstants.ROOM_SIZE - 1 - patternHeight;
    let closestSite: { x: number, y: number } | undefined;
    let shortestRange: number = this.MAX_DISTANCE;

    // search whole room
    for (let x = 1; x < searchWidth; x++) {
      for (let y = 1; y < searchHeight; y++) {
        // skip anything farther than closest site so far
        // use center of patten for ranging
        const posCenter = this.room.getPositionAt(x + patternWidth / 2, y + patternHeight / 2);
        const range = posCenter?.getRangeTo(Game.spawns['Spawn1'].pos);
        if (range && range >= shortestRange) {
          continue;
        }

        // check if this site is blocked by structures or walls
        structurePlan.translate(x, y, this.room.name);
        const blocked = structurePlan.plan.reduce<boolean>((blocked, pos) => {
          return blocked || this.checkForConstructionObstacle(pos, structurePlan.getStructureAt(pos))
        }, false);

        // if not blocked and closer than best site, remember it
        if (!blocked && range && range < shortestRange) {
          shortestRange = range;
          closestSite = { x, y };
        }
      }
    }

    // return best site found
    if (closestSite) {
      structurePlan.translate(closestSite.x, closestSite.y, this.room.name);
      console.log(`closest site: ${closestSite.x},${closestSite.y}`);
    }
    else {
      console.log(`No site for pattern found.`);
    }
    return structurePlan;
  }

  private checkForConstructionObstacle(pos: RoomPosition, plannedStructure: StructureConstant | null): boolean {
    if (this.terrain.get(pos.x, pos.y) == TERRAIN_MASK_WALL) {
      return true;
    }
    else {
      const posContents = this.room.lookAt(pos);
      return posContents.reduce<boolean>((blocked, item) => {
        return blocked ||
          (item.type == LOOK_CONSTRUCTION_SITES && item.constructionSite?.structureType != plannedStructure) ||
          (item.type == LOOK_STRUCTURES && item.structure?.structureType != plannedStructure)
      }, false);
    }
  }
}