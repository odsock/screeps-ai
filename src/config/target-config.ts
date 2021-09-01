/* eslint-disable prettier/prettier */
export class TargetConfig {
  // TODO: create AI targeting of rooms

  public static readonly TARGETS: {[x: string]: string[]} = {
    "shard3": []
  };

  public static readonly REMOTE_HARVEST: {[x: string]: string[]} = {
    "shard3": ["E18N55", "E17N54"]
  };

  public static readonly IMPORTERS_PER_REMOTE_ROOM = 4;
}
