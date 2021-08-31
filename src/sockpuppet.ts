import { CreepUtils } from "creep-utils";
import { MemoryUtils } from "planning/memory-utils";
import { Planner } from "planning/planner";
import { SpawnControl } from "spawn-control";
import { CreepFactory } from "roles/creep-factory";
import { RoomWrapper } from "structures/room-wrapper";
import { TowerWrapper } from "structures/tower-wrapper";
import { Constants } from "./constants";

export class Sockpuppet {
  public run(): void {
    // refresh global cache if missing
    // MemoryUtils.writeCacheToMemory();

    // Run each room
    for (const roomId in Game.rooms) {
      const roomw = new RoomWrapper(Game.rooms[roomId]);

      // only consider rooms we own
      if (roomw.controller?.owner?.username !== Constants.USERNAME) {
        continue;
      }

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
      // TODO refresh every turn maybe excessive?
      MemoryUtils.refreshRoomMemory(roomw);

      // Run spawners
      CreepUtils.consoleLogIfWatched(roomw, `running spawns`);
      const populationControl = new SpawnControl(roomw);
      populationControl.run();

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
        CreepFactory.getCreep(creep).run();
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
