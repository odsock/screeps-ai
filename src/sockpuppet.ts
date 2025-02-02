import { SockPuppetConstants } from "config/sockpuppet-constants";
import { AttackControl } from "control/attack-control";
import { BuildControl } from "control/build-control";
import { DefenseControl } from "control/defense-control";
import { HarvestControl } from "control/harvest-control";
import { HaulerControl } from "control/hauler-control";
import { LinkControl } from "control/link-control";
import { ReconControl } from "control/recon-control";
import { RemoteControl } from "control/remote-control";
import { SpawnControl } from "control/spawn-control";
import { UpgradeControl } from "control/upgrade-control";
import { Planner } from "planning/planner";
import { CreepFactory } from "roles/creep-factory";
import { RoomWrapper } from "structures/room-wrapper";
import { TowerWrapper } from "structures/tower-wrapper";
import { profile } from "../screeps-typescript-profiler";

@profile
export class Sockpuppet {
  public name = "sockpuppet";
  public memory = {};

  public run(): void {
    this.runControl();
    this.runRooms();
    this.runCreeps();
  }

  private runRooms(): void {
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

      // spawn new creeps
      new SpawnControl(roomw).run();

      // plan room structures
      if (Game.time % SockPuppetConstants.PLANNING_INTERVAL === 0) {
        new Planner(roomw).run();
      }
    });
  }

  private runControl(): void {
    new ReconControl().run();
    new DefenseControl().run();
    new AttackControl().run();
    new BuildControl().run();
    new HarvestControl().run();
    new HaulerControl().run();
    new RemoteControl().run();
    new UpgradeControl().run();
    new LinkControl().run();
  }

  public runCreeps(): void {
    for (const name in Game.creeps) {
      const creep = Game.creeps[name];
      if (!creep.spawning) {
        try {
          const creepw = CreepFactory.getCreep(creep);
          creepw.run();
          if (creepw.memory.draw) {
            creepw.roomw.visual.circle(creepw.pos.x, creepw.pos.y, { fill: "#FF0000" });
          }
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
