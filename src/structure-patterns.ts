/* eslint-disable prettier/prettier */
export class StructurePatterns {
  public static readonly FULL_COLONY: string[] = [
    "  r   r   r",
    " rer rer rer",
    "reeereeereeer",
    " rererererer",
    "  reeereeer",
    " rerer rerer",
    "reeer S reeer",
    " rerer rerer",
    "  reeereeer",
    " rererererer",
    "reeereeereeer",
    " rer rer rer",
    "  r   r   r"
  ];

  public static readonly EXTENSION_GROUP: string[] = [
    "  r",
    " rer",
    "reeer",
    " rer",
    "  r"
  ];

  public static readonly CHARACTERS: {[x: string]: StructureConstant | null} = {
    r: STRUCTURE_ROAD,
    e: STRUCTURE_EXTENSION,
    s: STRUCTURE_SPAWN,
    " ": null
  }

public static readonly STRUCTURE_PLAN_EXTENSION_GROUP: StructurePatternPosition[] = [
  { xOffset: 2, yOffset: 0, structure: STRUCTURE_ROAD },
  { xOffset: 1, yOffset: 1, structure: STRUCTURE_ROAD },
  { xOffset: 2, yOffset: 1, structure: STRUCTURE_EXTENSION },
  { xOffset: 3, yOffset: 1, structure: STRUCTURE_ROAD },
  { xOffset: 0, yOffset: 2, structure: STRUCTURE_ROAD },
  { xOffset: 1, yOffset: 2, structure: STRUCTURE_EXTENSION },
  { xOffset: 2, yOffset: 2, structure: STRUCTURE_EXTENSION },
  { xOffset: 3, yOffset: 2, structure: STRUCTURE_EXTENSION },
  { xOffset: 4, yOffset: 2, structure: STRUCTURE_ROAD },
  { xOffset: 1, yOffset: 3, structure: STRUCTURE_ROAD },
  { xOffset: 2, yOffset: 3, structure: STRUCTURE_EXTENSION },
  { xOffset: 3, yOffset: 3, structure: STRUCTURE_ROAD },
  { xOffset: 2, yOffset: 4, structure: STRUCTURE_ROAD }
];

}
