import { CreepUtils } from "creep-utils";
import { Planner } from "planning/planner";
import { SpawnControl } from "control/spawn-control";
import { CreepFactory } from "roles/creep-factory";
import { TowerWrapper } from "structures/tower-wrapper";
import { RoomWrapper } from "structures/room-wrapper";
import { DefenseControl } from "control/defense-control";
import { ReconControl } from "control/recon-control";

export class Sockpuppet {
  public name = "sockpuppet";
  public memory = {};

  public run(): void {
    // collect data about rooms we can see
    let cpu = Game.cpu.getUsed();
    const reconControl = new ReconControl();
    reconControl.run();
    CreepUtils.profile(this, `recon`, cpu);

    // spawn defense creeps
    cpu = Game.cpu.getUsed();
    console.log(`Running defense control`);
    const defenseControl = new DefenseControl();
    defenseControl.run();
    CreepUtils.profile(this, `defense`, cpu);

    // Run each room
    cpu = Game.cpu.getUsed();
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

      // Run spawners
      CreepUtils.consoleLogIfWatched(roomw, `running spawns`);
      const spawnControl = new SpawnControl(roomw);
      spawnControl.run();

      CreepUtils.consoleLogIfWatched(roomw, `running towers`);
      this.runTowers(roomw);

      // Plan each room every 10 ticks
      const planner = new Planner(roomw);
      if (Game.time % 10 === 0) {
        const result = planner.run();
        console.log(`planning result: ${result}`);
      }
    }
    CreepUtils.profile(this, `rooms`, cpu);

    const cpuBefore = Game.cpu.getUsed();
    this.runCreeps();
    const cpuAfter = Game.cpu.getUsed();
    CreepUtils.profile(this, `creeps`, cpuBefore);
    const cpuUsedForCreeps = cpuAfter - cpuBefore;

    if (!Memory.cpu) {
      Memory.cpu = { allCreeps: [], creepsByRole: {}, tickTotal: [] };
    }
    const allCreeps = Memory.cpu.allCreeps;
    allCreeps.push(cpuUsedForCreeps);
    if (allCreeps.length > CREEP_LIFE_TIME) {
      allCreeps.shift();
    }
  }

  public runCreeps(): void {
    const cpuByRole: { [role: string]: number[] } = {};
    for (const name in Game.creeps) {
      const creep = Game.creeps[name];
      if (!creep.spawning) {
        const creepw = CreepFactory.getCreep(creep);
        const cpuBefore = Game.cpu.getUsed();
        try {
          creepw.run();
          CreepUtils.profile(creepw, `TOTAL`, cpuBefore);
        } catch (error) {
          console.log(`ERROR: caught running creep ${creep.name}`, error);
        }
        const cpuAfter = Game.cpu.getUsed();
        const cpuUsed = cpuAfter - cpuBefore;
        cpuByRole[creepw.memory.role] = cpuByRole[creepw.memory.role] ?? [];
        cpuByRole[creepw.memory.role].push(cpuUsed);
      }
    }
    for (const role in cpuByRole) {
      Memory.cpu.creepsByRole[role] = Memory.cpu.creepsByRole[role] ?? [];
      const cpuAvg = cpuByRole[role].reduce((sum, cpu) => sum + cpu, 0) / cpuByRole[role].length;
      Memory.cpu.creepsByRole[role].push(cpuAvg);
      if (Memory.cpu.creepsByRole[role].length > CREEP_LIFE_TIME) {
        Memory.cpu.creepsByRole[role].shift();
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
