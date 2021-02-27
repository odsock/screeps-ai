import { CreepUtils } from "creep-utils";
import { PlannerUtils } from "./planner-utils";
import { RoadPlan } from "./road-plan";

export class ContainerPlan {
  public constructor(private readonly room: Room) { }

  public placeControllerContainer(): ScreepsReturnCode {
    if (this.room.controller && !this.roomHasContainersInConstruction()) {
      const controllerContainer = this.room.controller.pos.findInRange(FIND_STRUCTURES, 1, {
        filter: (c) => c.structureType == STRUCTURE_CONTAINER
      });
      if (controllerContainer.length == 0) {
        let pos = PlannerUtils.placeStructureAdjacent(this.room.controller.pos, STRUCTURE_CONTAINER);
        if (pos) {
          this.room.memory.controllerInfo.containerPos = pos;
          CreepUtils.roomMemoryLog(this.room, `created controller container: ${pos.x},${pos.y}`);
          return OK;
        }
        else {
          CreepUtils.roomMemoryLog(this.room, `create container failed for controller`);
          return ERR_NOT_FOUND;
        }
      }
    }
    return OK;
  }

  public placeSourceContainer(): ScreepsReturnCode {
    if (this.room.controller && !this.roomHasContainersInConstruction()) {
      // find closest source with no adjacent container
      const source = this.findSourceWithoutContainerCloseToController();
      if (source) {
        let pos = PlannerUtils.placeStructureAdjacent(source.pos, STRUCTURE_CONTAINER);
        if (pos) {
          this.room.memory.sourceInfo[source.id].containerPos = pos;
          CreepUtils.roomMemoryLog(this.room, `created source container: ${pos.x},${pos.y}`);
          return OK;
        }
        else {
          CreepUtils.roomMemoryLog(this.room, `create container failed for source: ${source.pos.x},${source.pos.y}`);
          return ERR_NOT_FOUND;
        }
      }
    }
    return OK;
  }

  private findSourceWithoutContainerCloseToController() {
    if (this.room.controller) {
      return this.room.controller.pos.findClosestByPath(FIND_SOURCES, {
        filter: (s) => s.pos.findInRange(FIND_STRUCTURES, 1, {
          filter: (c) => c.structureType == STRUCTURE_CONTAINER
        }).length == 0
      });
    }
    else {
      return null;
    }
  }

  private roomHasContainersInConstruction(): boolean {
    return this.room.find(FIND_MY_CONSTRUCTION_SITES, {
      filter: (s) => s.structureType == STRUCTURE_CONTAINER
    }).length > 0;
  }

  public static findClosestSourceWithoutContainer(pos: RoomPosition): Source | null {
    return pos.findClosestByPath(FIND_SOURCES, {
      filter: (s) => s.pos.findInRange(FIND_STRUCTURES, 1, {
        filter: (c) => c.structureType == STRUCTURE_CONTAINER
      }).length == 0
    });
  }
}