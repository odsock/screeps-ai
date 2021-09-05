// import { RoomWrapper } from "./room-wrapper";

// export class RoomFactory {
//   private rooms: Map<string, RoomWrapper>;

//   public constructor() {
//     this.rooms = new Map<string, RoomWrapper>();
//   }

//   public get(name: string): RoomWrapper {
//     let room = this.rooms.get(name);
//     if (!room) {
//       room = new RoomWrapper(Game.rooms[name]);
//       this.rooms.set(name, room);
//     }
//     return room;
//   }
// }
