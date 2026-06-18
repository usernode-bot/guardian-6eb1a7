import { Guardian, GuardianTier } from './types';
import {
  generateGuardianPool,
  getUnallocatedGuardians,
  getUnallocatedGuardiansByTier,
} from './guardianPool';

export function allocateGuardian(preferredTier?: GuardianTier): Guardian | null {
  let candidates: Guardian[];

  if (preferredTier) {
    candidates = getUnallocatedGuardiansByTier(preferredTier);
  } else {
    candidates = getUnallocatedGuardians();
  }

  if (candidates.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * candidates.length);
  const selected = candidates[randomIndex];

  selected.allocated = true;

  return selected;
}

export function deallocateGuardian(id: string): boolean {
  const pool = generateGuardianPool();
  const guardian = pool.find((g) => g.id === id);

  if (!guardian) {
    return false;
  }

  guardian.allocated = false;
  return true;
}

export function getAllocatedCount(): number {
  const pool = generateGuardianPool();
  return pool.filter((g) => g.allocated).length;
}

export function getUnallocatedCount(): number {
  const pool = generateGuardianPool();
  return pool.filter((g) => !g.allocated).length;
}
