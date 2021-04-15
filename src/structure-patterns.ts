/* eslint-disable prettier/prettier */
export class StructurePatterns {
  public static readonly FULL_COLONY: string[] = [
    "   r   r   r",
    "  rer rer rer",
    " reeereeereeer",
    "  rererererer",
    "   reeereeer",
    "  rerer rerer",
    " reeer S reeer",
    "  rerer rerer",
    "   reeereeer",
    "  rererererer",
    " reeereeereeer",
    "  rer rer rer",
    "   r   r   r"
  ];

  public static readonly EXTENSION_GROUP: string[] = [
    "   r",
    "  rer",
    " reeer",
    "  rer",
    "   r"
  ];

  public static readonly CHARACTERS: {[x: string]: StructureConstant | null} = {
    r: STRUCTURE_ROAD,
    e: STRUCTURE_EXTENSION,
    s: STRUCTURE_SPAWN,
    " ": null
  }
}
