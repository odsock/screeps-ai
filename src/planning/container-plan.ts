import { RoomWrapper } from "structures/room-wrapper";
import { PlannerUtils } from "./planner-utils";

export class ContainerPlan {
  private readonly room: RoomWrapper;

  public constructor(room: Room) {
    this.room = new RoomWrapper(room);
  }

  public placeControllerContainer(): ScreepsReturnCode {
    if (
      this.room.controller &&
      !this.roomHasContainersInConstruction() &&
      this.room.sourceContainers.length > this.room.controllerContainers.length
    ) {
      const id = PlannerUtils.placeStructureAdjacent(this.room.controller.pos, STRUCTURE_CONTAINER);
      if (id) {
        this.room.memory.controllerInfo.push({ containerId: id });
        return OK;
      }
      return ERR_NOT_FOUND;
    }
    return OK;
  }

  public placeSourceContainer(): ScreepsReturnCode {
    // TODO: remove requirement for controller
    if (this.room.controller && !this.roomHasContainersInConstruction()) {
      // find closest source with no adjacent container
      const source = this.findSourceWithoutContainerCloseToController();
      if (source) {
        console.log(` - source without container: ${source}`);
        const id = PlannerUtils.placeStructureAdjacent(source.pos, STRUCTURE_CONTAINER);
        if (id) {
          this.room.memory.sourceInfo[source.id].containerId = id;
          return OK;
        }
        return ERR_NOT_FOUND;
      }
    }
    return OK;
  }

  // BUG: returning null when should be 1
  private findSourceWithoutContainerCloseToController() {
    if (this.room.controller) {
      return this.room.controller.pos.findClosestByPath(FIND_SOURCES, {
        filter: s =>
          s.pos.findInRange(FIND_STRUCTURES, 1, {
            filter: c => c.structureType === STRUCTURE_CONTAINER
          }).length === 0
      });
    } else {
      return null;
    }
  }

  private roomHasContainersInConstruction(): boolean {
    return (
      this.room.find(FIND_MY_CONSTRUCTION_SITES, {
        filter: s => s.structureType === STRUCTURE_CONTAINER
      }).length > 0
    );
  }

  public static findClosestSourceWithoutContainer(pos: RoomPosition): Source | null {
    return pos.findClosestByPath(FIND_SOURCES, {
      filter: s =>
        s.pos.findInRange(FIND_STRUCTURES, 1, {
          filter: c => c.structureType === STRUCTURE_CONTAINER
        }).length === 0
    });
  }
}
