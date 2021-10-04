import { Planner } from "planning/planner";
import { SpawnControl } from "control/spawn-control";
import { CreepFactory } from "roles/creep-factory";
import { TowerWrapper } from "structures/tower-wrapper";
import { RoomWrapper } from "structures/room-wrapper";
import { DefenseControl } from "control/defense-control";
import { ReconControl } from "control/recon-control";
import { SockPuppetConstants } from "config/sockpuppet-constants";
import { HaulerControl } from "control/hauler-control";

export class Sockpuppet {
  public name = "sockpuppet";
  public memory = {};

  public run(): void {
    // collect data about rooms we can see
    const reconControl = new ReconControl();
    reconControl.run();

    // spawn defense creeps
    const defenseControl = new DefenseControl();
    defenseControl.run();

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

      const spawnControl = new SpawnControl(roomw);
      spawnControl.run();
      this.runTowers(roomw);

      // Plan each room on interval
      const planner = new Planner(roomw);
      if (Game.time % SockPuppetConstants.PLANNING_INTERVAL === 0) {
        planner.run();
      }
    });

    // assign tasks to haulers
    new HaulerControl().run();

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
