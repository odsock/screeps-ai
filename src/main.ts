import { ErrorMapper } from "utils/ErrorMapper";

export const loop = ErrorMapper.wrapLoop(() => {
  if(!Memory.posTest) {
    Memory.posTest = new RoomPosition(1, 1, 'sim');
  }
  const pos = Memory.posTest;
  console.log(pos);
  console.log(Game.rooms['sim'].createFlag(pos));

  const roomPos = Object.create(RoomPosition.prototype, Object.getOwnPropertyDescriptors(pos));
  console.log(roomPos);
  console.log(Game.rooms['sim'].createFlag(roomPos));
});
