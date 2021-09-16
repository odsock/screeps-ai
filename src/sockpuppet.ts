import { CreepUtils } from "creep-utils";
import { MemoryUtils } from "planning/memory-utils";
import { Planner } from "planning/planner";
import { SpawnControl } from "control/spawn-control";
import { CreepFactory } from "roles/creep-factory";
import { TowerWrapper } from "structures/tower-wrapper";
import { SockPuppetConstants } from "./config/sockpuppet-constants";
import { RoomWrapper } from "structures/room-wrapper";

export class Sockpuppet {
  public run(): void {
    // refresh global cache if missing
    // MemoryUtils.writeCacheToMemory();

    // Run each room
    for (const name in Game.rooms) {
      const roomw = RoomWrapper.getInstance(name);
      if (!roomw) {
        console.log(`ERROR: bad room name ${name}`);
        continue;
      }

      // record hostile creeps
      const hostileCreeps = roomw.find(FIND_HOSTILE_CREEPS);
      if (hostileCreeps.length === 0) {
        roomw.memory.defense = { hostiles: [] };
      } else {
        roomw.memory.defense = { hostiles: hostileCreeps };
      }

      // only consider rooms we own
      if (roomw.controller?.my) {
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
