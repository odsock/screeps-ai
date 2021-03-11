import { Spawn } from "./spawn";

export class RoomWrapper extends Room {
  public constructor(roomId: string) {
    super(roomId);
  }

  get spawns(): Spawn[] {
    return this.find(FIND_MY_SPAWNS).map((spawn) => new Spawn(spawn));
  } 
}