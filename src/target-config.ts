/* eslint-disable prettier/prettier */
export class TargetConfig {
  // TODO: create AI targeting of rooms

  // TODO assume controlled rooms are targets?
  public static readonly TARGETS: {[x: string]: string[]} = {
    "shard3": ["E17N55", "E18N55"]
  };

  public static readonly REMOTE_HARVEST: {[x: string]: string[]} = {
    "shard3": ["E18N55"]
  };
}
