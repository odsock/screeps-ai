import { CreepRole } from "config/creep-types";
import { MemoryUtils } from "planning/memory-utils";
import { PlannerUtils } from "planning/planner-utils";
import { SpawnQueue } from "planning/spawn-queue";
import { Scout } from "roles/scout";
import { RoomWrapper } from "structures/room-wrapper";
import { SpawnUtils } from "./spawn-utils";
import { TargetControl } from "./target-control";

// TODO create recon memory separate from colony memory
import { profile } from "../../screeps-typescript-profiler";

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
    const freeScouts = scouts.filter(s => Game.time - (Memory.rooms[s.memory.targetRoom]?.reconTick ?? 0) < 1000);
    for (const roomName of this.targetControl.scoutRooms) {
      const scoutOnRoom = [...scouts, ...spawningScouts].some(s => s.memory.targetRoom === roomName);
      if (!scoutOnRoom && Game.time - (Memory.rooms[roomName]?.reconTick ?? 0) >= 1000) {
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
    if (controllerInfo.container?.id && !Game.getObjectById(controllerInfo.container.id)) {
      controllerInfo.container.id = undefined;
    }
    if (controllerInfo.link?.id && !Game.getObjectById(controllerInfo.link.id)) {
      controllerInfo.link.id = undefined;
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
      if (sourceInfo.container?.id && !Game.getObjectById(sourceInfo.container.id)) {
        sourceInfo.container.id = undefined;
      }
      if (sourceInfo.link?.id && !Game.getObjectById(sourceInfo.link.id)) {
        sourceInfo.link.id = undefined;
      }
      if (sourceInfo.minderId && !Game.getObjectById(sourceInfo.minderId)) {
        sourceInfo.minderId = undefined;
      }
    }
  }

  private initRoomSources(room: RoomWrapper): RoomSources {
    const roomSources: RoomSources = {};
    room.find(FIND_SOURCES).forEach(source => {
      roomSources[source.id] = {
        id: source.id,
        pos: MemoryUtils.packRoomPosition(source.pos),
        harvestPositions: this.findHarvestPositions(source, room)
      };
    });
    return roomSources;
  }

  private findHarvestPositions(source: Source, room: RoomWrapper) {
    const plannerUtils = new PlannerUtils(source.room);
    return plannerUtils
      .getPositionSpiral(source.pos, 1)
      .filter(pos => room.isEnterable(pos))
      .map(pos => MemoryUtils.packRoomPosition(pos));
  }
}
