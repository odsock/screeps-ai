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
import { UpgradeControl } from "control/upgrade-control";
import { BuildControl } from "control/build-control";
import { RemoteControl } from "control/remote-control";
import { profile } from "../screeps-typescript-profiler";

@profile
export class Sockpuppet {
  public name = "sockpuppet";
  public memory = {};

  public run(): void {
    new BuildControl().run();
    new DefenseControl().run();
    new HarvestControl().run();
    new HaulerControl().run();
    new ReconControl().run();
    new RemoteControl().run();
    new UpgradeControl().run();

    // Run each room
    _.filter(Game.rooms, room => room.controller?.my).forEach(room => {
      const roomw = RoomWrapper.getInstance(room);

      // cpu test
      let cpu = Game.cpu.getUsed();
      const extensions = roomw.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === "extension" });
      console.log(`cpu: ${Game.cpu.getUsed() - cpu}`);
      // cpu: 0.0328405999999859
      cpu = Game.cpu.getUsed();
      roomw.find(FIND_MY_STRUCTURES, { filter: s => s.structureType !== "extension" });
      console.log(`cpu: ${Game.cpu.getUsed() - cpu}`);
      const ids = extensions.map(e => e.id);
      cpu = Game.cpu.getUsed();
      ids.forEach(id => Game.getObjectById(id));
      console.log(`cpu: ${Game.cpu.getUsed() - cpu}`);
      // cpu: 0.0074802000000318

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
