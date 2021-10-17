import { Planner } from "planning/planner";
import { SpawnControl } from "control/spawn-control";
import { CreepFactory } from "roles/creep-factory";
import { TowerWrapper } from "structures/tower-wrapper";
import { RoomWrapper } from "structures/room-wrapper";
import { DefenseControl } from "control/defense-control";
import { ReconControl } from "control/recon-control";
import { SockPuppetConstants } from "config/sockpuppet-constants";
import { HaulerControl } from "control/hauler-control";
import { HarvestControl } from "control/harvest-control";

export class Sockpuppet {
  public name = "sockpuppet";
  public memory = {};

  public run(): void {
    // collect data about rooms we can see
    new ReconControl().run();

    // spawn defense creeps
    new DefenseControl().run();

    // assign tasks to haulers
    new HaulerControl().run();

    // manage harvesters
    new HarvestControl().run();

    // Run each room
    _.filter(Game.rooms, room => room.controller?.my).forEach(room => {
      const roomw = RoomWrapper.getInstance(room);

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

      this.runTowers(roomw);

      // Plan each room on interval
      if (Game.time % SockPuppetConstants.PLANNING_INTERVAL === 0) {
        new Planner(roomw).run();
      }

      // spawn new creeps
      new SpawnControl(roomw).run();
    });

    this.runCreeps();
  }

  public runCreeps(): void {
    for (const name in Game.creeps) {
      const creep = Game.creeps[name];
      if (!creep.spawning) {
        const creepw = CreepFactory.getCreep(creep);
        try {
          creepw.run();
        } catch (error) {
          console.log(`ERROR: caught running creep ${creep.name}`, error);
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
