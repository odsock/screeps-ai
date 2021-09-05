export class TargetConfig {
  // TODO: create AI targeting of rooms

  public static readonly TARGETS: { [x: string]: string[] } = {
    shard3: ["E17N55"]
  };

  public static readonly REMOTE_HARVEST: { [x: string]: string[] } = {
    shard3: ["E17N54"]
  };

  // TODO dynamic importer counts
  public static readonly IMPORTERS_PER_REMOTE_ROOM = 2;
}
