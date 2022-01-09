import { CreepRole } from "config/creep-types";
import { MemoryUtils } from "planning/memory-utils";
import { PlannerUtils } from "planning/planner-utils";
import { SpawnQueue } from "planning/spawn-queue";
import { Scout } from "roles/scout";
import { RoomWrapper } from "structures/room-wrapper";
import { profile } from "../../screeps-typescript-profiler";
import { SpawnUtils } from "./spawn-utils";
import { TargetControl } from "./target-control";

// TODO create recon memory separate from colony memory
@profile
export class ReconControl {
  private readonly targetControl: TargetControl;
  public constructor() {
    this.targetControl = TargetControl.getInstance();
  }

  public run(): void {
    // check each room we can see
    for (const roomName in Game.rooms) {
      const room = RoomWrapper.getInstance(roomName);
      room.memory.owner = room.controller?.owner?.username ?? room.controller?.reservation?.username;
      this.refreshRoomDefense(room);
      this.refreshSourceMemory(room);
      this.refreshControllerMemory(room);
      room.memory.reconTick = Game.time;
    }

    const scouts = _.filter(Game.creeps, c => c.memory.role === CreepRole.SCOUT);
    const spawningScouts = SpawnUtils.getSpawnInfo(s => s.memory.role === CreepRole.SCOUT);
    const freeScouts = scouts.filter(s => Game.time - Memory.rooms[s.memory.targetRoom].reconTick < 1000);
    for (const roomName of this.targetControl.scoutRooms) {
      const scoutOnRoom = [...scouts, ...spawningScouts].some(s => s.memory.targetRoom === roomName);
      if (!scoutOnRoom && Game.time - Memory.rooms[roomName].reconTick >= 1000) {
        if (freeScouts.length > 0) {
          freeScouts[0].memory.targetRoom = roomName;
        } else {
          this.requestSpawn(roomName);
        }
      }
    }
  }

  private requestSpawn(targetRoom: string): void {
    const closestSpawnRoom = SpawnUtils.findClosestAvailableSpawnRoom(targetRoom);
    if (closestSpawnRoom) {
      const spawnQueue = SpawnQueue.getInstance(closestSpawnRoom);
      spawnQueue.push({
        bodyProfile: Scout.BODY_PROFILE,
        max: true,
        memory: {
          role: CreepRole.SCOUT,
          targetRoom
        },
        priority: 200
      });
    }
  }

  private refreshRoomDefense(room: RoomWrapper) {
    const hostileCreeps = room.find(FIND_HOSTILE_CREEPS);
    const hostileStructures = room.find(FIND_HOSTILE_STRUCTURES);
    room.memory.defense = { creeps: hostileCreeps, structures: hostileStructures };
  }

  private refreshControllerMemory(room: Room): void {
    if (!room.controller) {
      return;
    }
    // initialize controller memory
    if (!room.memory.controller) {
      room.memory.controller = {
        pos: MemoryUtils.packRoomPosition(room.controller?.pos),
        ticksToDowngrade: room.controller.ticksToDowngrade,
        upgradeBlocked: room.controller.upgradeBlocked,
        level: room.controller.level
      };
    }
    const controllerInfo = room.memory.controller;

    // update ownership
    // TODO object copy stuff instead of this
    room.memory.controller.owner = room.controller.owner;
    room.memory.controller.reservation = room.controller.reservation;
    room.memory.controller.ticksToDowngrade = room.controller.ticksToDowngrade;
    room.memory.controller.upgradeBlocked = room.controller.upgradeBlocked;
    room.memory.controller.level = room.controller.level;

    // validate id's
    if (controllerInfo.containerId && !Game.getObjectById(controllerInfo.containerId)) {
      controllerInfo.containerId = undefined;
    }
    if (controllerInfo.linkId && !Game.getObjectById(controllerInfo.linkId)) {
      controllerInfo.linkId = undefined;
    }
    if (controllerInfo.haulerId && !Game.getObjectById(controllerInfo.haulerId)) {
      controllerInfo.haulerId = undefined;
    }
  }

  private refreshSourceMemory(room: RoomWrapper): void {
    // initialize source memory
    if (!room.memory.sources) {
      room.memory.sources = this.initRoomSources(room);
      return;
    }

    // validate id's
    for (const sourceId in room.memory.sources) {
      const sourceInfo = room.memory.sources[sourceId];
      if (sourceInfo.containerId && !Game.getObjectById(sourceInfo.containerId)) {
        sourceInfo.containerId = undefined;
      }
      if (sourceInfo.linkId && !Game.getObjectById(sourceInfo.linkId)) {
        sourceInfo.linkId = undefined;
      }
      if (sourceInfo.minderId && !Game.getObjectById(sourceInfo.minderId)) {
        sourceInfo.minderId = undefined;
      }
      if (sourceInfo.haulerId && !Game.getObjectById(sourceInfo.haulerId)) {
        sourceInfo.haulerId = undefined;
      }
    }
  }

  private initRoomSources(room: RoomWrapper): RoomSources {
    const roomSources: RoomSources = {};
    room.find(FIND_SOURCES).forEach(source => {
      roomSources[source.id] = {
        id: source.id,
        pos: MemoryUtils.packRoomPosition(source.pos),
        harvestPositions: this.findHarvestPositions(source)
      };
    });
    return roomSources;
  }

  private findHarvestPositions(source: Source) {
    return PlannerUtils.getPositionSpiral(source.pos, 1)
      .filter(pos => PlannerUtils.isEnterable(pos))
      .map(pos => MemoryUtils.packRoomPosition(pos));
  }
}
