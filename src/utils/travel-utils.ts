export class TravelUtils {
  public static calcRoomGridDistance(roomNameA: string, roomNameB: string): number {
    const roomNameASplit = /^([EW])(\d+)([NS])(\d+)$/.exec(roomNameA);
    const roomNameBSplit = /^([EW])(\d+)([NS])(\d+)$/.exec(roomNameB);
    if (roomNameASplit && roomNameBSplit) {
      const posAx = (roomNameASplit[1] === "W" ? 1 : -1) * Number(roomNameASplit[2]);
      const posAy = (roomNameASplit[3] === "N" ? 1 : -1) * Number(roomNameASplit[4]);
      const posBx = (roomNameBSplit[1] === "W" ? 1 : -1) * Number(roomNameBSplit[2]);
      const posBy = (roomNameBSplit[3] === "N" ? 1 : -1) * Number(roomNameBSplit[4]);
      return Math.abs(posAx - posBx) + Math.abs(posAy - posBy);
    }
    return NaN;
  }

  public static findClosestRoom(roomName: string, roomNames: string[]): string | undefined {
    let closestRoomName: string | undefined;
    let distance: number | undefined;
    for (const newRoom of roomNames) {
      const newDistance = this.calcRoomGridDistance(roomName, newRoom);
      closestRoomName = closestRoomName ?? newRoom;
      distance = distance ?? newDistance;
      if (newDistance < distance) {
        distance = newDistance;
        closestRoomName = newRoom;
      }
    }
    return closestRoomName;
  }
}
