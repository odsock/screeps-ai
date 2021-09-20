import { CreepUtils } from "creep-utils";
import { MemoryUtils } from "planning/memory-utils";
import { Planner } from "planning/planner";
import { SpawnControl } from "control/spawn-control";
import { CreepFactory } from "roles/creep-factory";
import { TowerWrapper } from "structures/tower-wrapper";
import { RoomWrapper } from "structures/room-wrapper";
import { DefenseControl } from "control/defense-control";

export class Sockpuppet {
  public run(): void {
    // refresh global cache if missing
    // MemoryUtils.writeCacheToMemory();

    // spawn defense creeps
    console.log(`Running defense control`);
    const defenseControl = new DefenseControl();
    defenseControl.run();

    // Run each room
    for (const name in Game.rooms) {
      // only consider rooms we own for colony planning and control
      if (!Game.rooms[name].controller?.my) {
        CreepUtils.consoleLogIfWatched(Game.rooms[name], `skipping unowned room ${name}`);
        continue;
      }

      const roomw = RoomWrapper.getInstance(name);

      // draw colony poc
      const planVisual = roomw.planVisual;
      if (planVisual) {
        roomw.visual.import(planVisual);
      }

      // draw dismantle queue
      const dismantleVisual = roomw.dismantleVisual;
      if (dismantleVisual) {
        roomw.visual.import(dismantleVisual);
      }

      const planner = new Planner(roomw);
      MemoryUtils.refreshRoomMemory(roomw);

      // Run spawners
      CreepUtils.consoleLogIfWatched(roomw, `running spawns`);
      const spawnControl = new SpawnControl(roomw);
      spawnControl.run();

      CreepUtils.consoleLogIfWatched(roomw, `running towers`);
      this.runTowers(roomw);

      // Plan each room every 10 ticks
      if (Game.time % 10 === 0) {
        const result = planner.run();
        console.log(`planning result: ${result}`);
      }
    }

    this.runCreeps();

    // write global cache to memory
    // MemoryUtils.writeCacheToMemory();
  }

  public runCreeps(): void {
    for (const name in Game.creeps) {
      const creep = Game.creeps[name];
      if (!creep.spawning) {
        try {
          const creepw = CreepFactory.getCreep(creep);
          creepw.run();
        } catch (error) {
          console.log(`ERROR: caught running creep ${creep.name}: ${JSON.stringify(error)}`);
        }
      }
    }
  }

  public runTowers(room: Room): void {
    const towers = room
      .find<StructureTower>(FIND_MY_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_TOWER
      })
      .map(t => new TowerWrapper(t));

    for (const tower of towers) {
      tower.run();
    }
  }
}
