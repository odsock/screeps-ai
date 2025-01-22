export interface CreepBodyProfile {
  profile: BodyPartConstant[];
  seed: BodyPartConstant[];
  maxBodyParts: number;
  maxWorkParts?: number;
}

import { profile } from "../../screeps-typescript-profiler";

@profile
export class CreepBodyUtils {
  /**
   * Creates a creep body profile with the max size based on number of parts needed for a part type
   */
  public static buildBodyProfile(
    bodyProfile: CreepBodyProfile,
    partsNeeded: number,
    type: BodyPartConstant
  ): CreepBodyProfile {
    const newProfile: CreepBodyProfile = { ...bodyProfile };
    const partsOfTypeInProfile = newProfile.profile.filter(part => part === type).length;
    const partsOfTypeInSeed = newProfile.seed.filter(part => part === type).length;
    newProfile.maxBodyParts =
      ((partsNeeded - partsOfTypeInSeed) / partsOfTypeInProfile) * newProfile.profile.length + newProfile.seed.length;
    return newProfile;
  }

  public static addPartsToSeed(
    bodyProfile: CreepBodyProfile,
    partsNeeded: number,
    type: BodyPartConstant
  ): CreepBodyProfile {
    const newProfile: CreepBodyProfile = { ...bodyProfile };
    for (let i = 0; i < partsNeeded; i++) {
      newProfile.seed.push(type);
    }
    return newProfile;
  }
}
