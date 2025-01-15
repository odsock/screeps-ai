export interface CreepBodyProfile {
  profile: BodyPartConstant[];
  seed: BodyPartConstant[];
  maxBodyParts: number;
  maxWorkParts?: number;
}

export class CreepBodyUtils {
  /**
   * Updates a creep body profile with a max size based on number of parts needed for a part type
   */
  public static buildBodyProfile(
    bodyProfile: CreepBodyProfile,
    partsNeeded: number,
    type: BodyPartConstant
  ): CreepBodyProfile {
    const partsOfTypeInProfile = bodyProfile.profile.filter(part => part === type).length;
    bodyProfile.maxBodyParts =
      (partsNeeded / partsOfTypeInProfile) * bodyProfile.profile.length + bodyProfile.seed.length;
    return bodyProfile;
  }
}
