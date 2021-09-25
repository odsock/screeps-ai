export class TargetConfig {
  // TODO: create AI targeting of rooms

  public static readonly TARGETS: { [x: string]: string[] } = {
    shard3: [],
    sim: []
  };

  // BUG if you change this config and deploy, queue is not updated
  public static readonly REMOTE_HARVEST: { [x: string]: string[] } = {
    shard3: ["E17N54", "E18N55"],
    sim: []
  };
}
