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

  public purgeDeadCreeps(): RoomClaim {
    const newClaims = this.claims.filter(id => !!Game.getObjectById(id));
    this.claims = newClaims;
    return this;
  }

  public toString(): string {
    const claimsList = this.claims.join();
    return `{ ${this.name}, ${claimsList} }`;
  }
}
