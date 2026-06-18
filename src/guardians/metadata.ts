import { Guardian, GuardianMetadata, UserNodeContext } from './types';

export function buildGuardianMetadata(
  guardian: Guardian,
  userNodeContext: UserNodeContext
): GuardianMetadata {
  return {
    id: guardian.id,
    name: guardian.name,
    tier: guardian.tier,
    fgHours: userNodeContext.fgHours,
    peerCount: userNodeContext.peerCount,
    createdAt: Date.now(),
  };
}

export function formatGuardianMetadata(metadata: GuardianMetadata): string {
  return JSON.stringify(metadata, null, 2);
}
