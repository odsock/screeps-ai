import { MemoryUtils } from "planning/memory-utils";

interface Ticket<T> {
  item: T;
  creepId?: Id<Creep>;
  priority: number;
}

import { profile } from "../../screeps-typescript-profiler";

@profile
export class Queue<T> {
  private store: Ticket<T>[] = [];

  public constructor(
    private readonly cacheKey: string,
    private readonly initializer?: () => T[],
    private readonly validator?: (item: T) => boolean
  ) {
    const queue = MemoryUtils.getCache<Ticket<T>[]>(this.cacheKey);
    if (queue) {
      this.store = queue;
    } else if (this.initializer) {
      this.store = this.initializer().map(item => {
        return { item } as Ticket<T>;
      });
      MemoryUtils.setCache(this.cacheKey, this.store, CREEP_LIFE_TIME * 2);
    }
  }

  /** add a valid ticket to the queue */
  public push(item: T, priority = 0): boolean {
    if (!this.validator || this.validator(item)) {
      this.store.push({ item, priority } as Ticket<T>);
      this.store.sort((a, b) => a.priority - b.priority);
      MemoryUtils.setCache(this.cacheKey, this.store, CREEP_LIFE_TIME * 2);
      return true;
    }
    return false;
  }

  /** claim a valid ticket */
  public claim(id: Id<Creep>): T | undefined {
    // validate all tickets if validator function provided
    if (this.validator) {
      this.store = this.store.filter(ticket => this.validator && this.validator(ticket.item));
    }

    // find unclaimed ticket, or take one from a dead creep
    const claimTicket = this.store.find(ticket => {
      return !ticket.creepId || !Game.getObjectById(ticket.creepId);
    });

    // claim the ticket
    if (claimTicket) {
      claimTicket.creepId = id;
    }

    MemoryUtils.setCache(this.cacheKey, this.store, CREEP_LIFE_TIME * 2);
    return claimTicket?.item;
  }

  /** remove a valid ticket from queue */
  public pop(): T | undefined {
    let ticket;
    do {
      ticket = this.store.shift();
    } while (ticket && this.validator && !this.validator(ticket.item));
    MemoryUtils.setCache(this.cacheKey, this.store, CREEP_LIFE_TIME * 2);
    return ticket?.item;
  }

  public static creepNameValidator = (name: string): boolean => {
    return !!Game.creeps[name];
  };

  public static idValidator = (id: string): boolean => {
    return !!Game.getObjectById(id);
  };
}
