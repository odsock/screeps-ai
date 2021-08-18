import { RoomWrapper } from "structures/room-wrapper";
import { PlannerUtils } from "./planner-utils";

export class ContainerPlan {
  private readonly roomw: RoomWrapper;

  public constructor(room: Room) {
    this.roomw = new RoomWrapper(room);
  }

  public placeControllerContainer(): ScreepsReturnCode {
    if (
      this.roomw.controller &&
      !this.roomHasContainersInConstruction() &&
      this.roomw.sourceContainers.length > this.roomw.controllerContainers.length
    ) {
      console.log(` - placing controller container`);
      const id = PlannerUtils.placeStructureAdjacent(this.roomw.controller.pos, STRUCTURE_CONTAINER);
      if (id) {
        this.roomw.memory.containers.push({ containerId: id, nearController: true, nearSource: false, haulers: [] });
        return OK;
      }
      return ERR_NOT_FOUND;
    }
    return OK;
  }

  public placeSourceContainer(): ScreepsReturnCode {
    // TODO: remove requirement for controller
    if (this.roomw.controller && !this.roomHasContainersInConstruction()) {
      // find closest source with no adjacent container
      const source = this.findSourceWithoutContainerCloseToController();
      if (source) {
        console.log(` - source without container: ${String(source)}`);
        const id = PlannerUtils.placeStructureAdjacent(source.pos, STRUCTURE_CONTAINER);
        if (id) {
          this.roomw.memory.containers.push({
            containerId: id,
            nearSource: true,
            nearController: false,
            haulers: []
          });
          return OK;
        }
        return ERR_NOT_FOUND;
      }
    }
    return OK;
  }

  // BUG: returning null when should be 1
  private findSourceWithoutContainerCloseToController() {
    if (this.roomw.controller) {
      return this.roomw.controller.pos.findClosestByPath(FIND_SOURCES, {
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
      this.roomw.find(FIND_MY_CONSTRUCTION_SITES, {
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
