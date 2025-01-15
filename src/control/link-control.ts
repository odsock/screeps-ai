import { CreepUtils } from "creep-utils";
import { RoomWrapper } from "structures/room-wrapper";

export class LinkControl {
  public run(): void {
    for (const roomName in Game.rooms) {
      const roomw = RoomWrapper.getInstance(roomName);
      const sourceLinks = this.getSourceLinks(roomw);
      const controllerLink = this.getControllerLink(roomw);
      const storageLink = this.getStorageLink(roomw);
      CreepUtils.consoleLogIfWatched(
        roomw,
        `links: source: ${sourceLinks.length}, controller: ${controllerLink?.id}, storage: ${storageLink?.id}`
      );

      // move energy out of source links if they are full
      sourceLinks.forEach(sourceLink => {
        if (sourceLink.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
          if (controllerLink && controllerLink.store.getFreeCapacity(RESOURCE_ENERGY) > LINK_CAPACITY / 2) {
            const result = sourceLink.transferEnergy(controllerLink);
            CreepUtils.consoleLogIfWatched(roomw, `links: transferring to controller`, result);
          } else if (storageLink) {
            const result = sourceLink.transferEnergy(storageLink);
            CreepUtils.consoleLogIfWatched(roomw, `links: transferring to storage`, result);
          }
        }
      });
    }
  }

  private getStorageLink(roomw: RoomWrapper): StructureLink | undefined {
    const linkId = roomw.memory.storage?.link?.id;
    if (linkId) {
      return Game.getObjectById(linkId) ?? undefined;
    }
    return undefined;
  }

  private getControllerLink(roomw: RoomWrapper): StructureLink | undefined {
    const linkId = roomw.memory.controller.link?.id;
    if (linkId) {
      return Game.getObjectById(linkId) ?? undefined;
    }
    return undefined;
  }

  private getSourceLinks(roomw: RoomWrapper): StructureLink[] {
    const sourceLinks: StructureLink[] = [];
    for (const sourceId in roomw.memory.sources) {
      const linkId = roomw.memory.sources[sourceId].link?.id;
      if (linkId) {
        const link = Game.getObjectById(linkId);
        if (link) {
          sourceLinks.push(link);
        }
      }
    }
    return sourceLinks;
  }
}
