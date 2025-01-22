import { profile } from "../../screeps-typescript-profiler";

@profile
export class RoomClaim {
  private claims: Id<Creep>[];

  public constructor(private readonly roomName: string) {
    this.claims = [];
  }

  public get name(): string {
    return this.roomName;
  }

  public get count(): number {
    return this.claims.length;
  }

  public get(id: Id<Creep>): RoomClaim {
    if (!this.claims.includes(id)) {
      this.claims.push(id);
    }
    return this;
  }

  public static purgeDeadCreeps(claim: RoomClaim): RoomClaim {
    const newClaims = claim.claims.filter(id => !!Game.getObjectById(id));
    claim.claims = newClaims;
    return claim;
  }

  public toString(): string {
    const claimsList = this.claims.join();
    return `{ ${this.name}, ${claimsList} }`;
  }
}
