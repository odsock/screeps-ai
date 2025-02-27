/**
 * Ripped from https://github.com/AlinaNova21/ZeSwarm/
 * Organized by Carson Burke and xTwisteDx
 *
 * At point of writing, this "exploit" is not an official feature nor a violation of the TOS.
 * It has officially been implicitly endorsed by o4 as he has shared the code publically
 *
 * Usage:
 * register MemoryHack
 * import MemoryHack into main file
 * At start of loop, run MemoryHack
 */
export class MemoryHack {
  private static memory: Memory | undefined;

  public static register(): void {
    this.memory = Memory;
    this.memory = RawMemory._parsed;
  }

  public static runHack(): void {
    delete global.Memory;
    global.Memory = this.memory;
    RawMemory._parsed = this.memory;
  }
}

MemoryHack.register();
