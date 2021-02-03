class Constants {
  static readonly MAX_CREEPS: number = 4;
  static readonly BODY_PROFILE_WORKER: BodyPartConstant[] = [WORK, MOVE, CARRY];
  static readonly BODY_PROFILE_HARVESTER: BodyPartConstant[] = [WORK];

  static readonly STRUCTURE_PLAN_EXTENSION_GROUP: StructurePlanPosition[] = [
    {xOffset: 2, yOffset: 0, structure: STRUCTURE_ROAD},
    {xOffset: 1, yOffset: 1, structure: STRUCTURE_ROAD},
    {xOffset: 2, yOffset: 1, structure: STRUCTURE_EXTENSION},
    {xOffset: 3, yOffset: 1, structure: STRUCTURE_ROAD},
    {xOffset: 0, yOffset: 2, structure: STRUCTURE_ROAD},
    {xOffset: 1, yOffset: 2, structure: STRUCTURE_EXTENSION},
    {xOffset: 2, yOffset: 2, structure: STRUCTURE_EXTENSION},
    {xOffset: 3, yOffset: 2, structure: STRUCTURE_EXTENSION},
    {xOffset: 4, yOffset: 2, structure: STRUCTURE_ROAD},
    {xOffset: 1, yOffset: 3, structure: STRUCTURE_ROAD},
    {xOffset: 2, yOffset: 3, structure: STRUCTURE_EXTENSION},
    {xOffset: 3, yOffset: 3, structure: STRUCTURE_ROAD},
    {xOffset: 2, yOffset: 4, structure: STRUCTURE_ROAD}
  ];

  static readonly ROOM_SIZE = 50;
  static readonly MAX_DISTANCE = 99999;
}
export default Constants;