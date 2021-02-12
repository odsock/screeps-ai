import { PlannerUtils } from "./planner-utils";

export class ContainerPlan {
  private containerInConstruction = false;

  public constructor(private readonly room: Room) {
    this.containerInConstruction = this.roomHasContainersInConstruction();
  }

  public planContainers() {
    if (this.room.controller) {
      if (this.roomHasContainers()) {
        this.placeControllerContainer();
      }
    }
  }

  public placeControllerContainer() {
    if (this.room.controller && !this.roomHasContainersInConstruction() && this.roomHasContainers()) {
      let pos = PlannerUtils.placeStructureAdjacent(this.room.controller.pos, STRUCTURE_CONTAINER);
      if (pos) {
        console.log(`${this.room.name}: create controller container: ${pos.x},${pos.y}`);
      }
      else {
        console.log(`${this.room.name}: create container failed for controller`);
      }
    }
  }

  public placeSourceContainers() {
    if (this.room.controller && !this.roomHasContainersInConstruction()) {
      // find closest source with no adjacent container
      const source = this.room.controller.pos.findClosestByPath(FIND_SOURCES, {
        filter: (s) => s.pos.findInRange(FIND_STRUCTURES, 1, {
          filter: (c) => c.structureType == STRUCTURE_CONTAINER
        }).length == 0
      });
      if (source) {
        let pos = PlannerUtils.placeStructureAdjacent(source.pos, STRUCTURE_CONTAINER);
        if (pos) {
          console.log(`${this.room.name}: create source container: ${pos.x},${pos.y}`);
        }
        else {
          console.log(`${this.room.name}: create container failed for source: ${source.pos.x},${source.pos.y}`);
        }
      }
    }
  }

  private roomHasContainersInConstruction(): boolean {
    return this.room.find(FIND_MY_CONSTRUCTION_SITES, {
      filter: (s) => s.structureType == STRUCTURE_CONTAINER
    }).length > 0;
  }

  private roomHasContainers(): boolean {
    return this.room.find(FIND_STRUCTURES, {
      filter: (s) => s.structureType == STRUCTURE_CONTAINER
    }).length > 0;
  }
}