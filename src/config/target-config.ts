export class TargetConfig {
  // TODO use flags to mark rooms
  // TODO create AI targeting of rooms

  public static readonly TARGETS: { [x: string]: string[] } = {
    shard3: [],
    sim: []
  };

  public static readonly REMOTE_HARVEST: { [x: string]: string[] } = {
    shard3: ["E17N54", "E18N55"],
    sim: []
  };
  public static readonly CLEAN: { [x: string]: string[] } = {
    shard3: ["E19N55"],
    sim: []
  };
}
