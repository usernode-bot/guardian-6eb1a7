export type GuardianTier = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'MYTHIC';

export const RARITY_CONFIG: Record<GuardianTier, number> = {
  COMMON: 300,
  RARE: 120,
  EPIC: 60,
  LEGENDARY: 18,
  MYTHIC: 2,
};

export const TOTAL_GUARDIANS = 500;

export function getTierByIndex(index: number): GuardianTier {
  if (index < 300) return 'COMMON';
  if (index < 420) return 'RARE';
  if (index < 480) return 'EPIC';
  if (index < 498) return 'LEGENDARY';
  return 'MYTHIC';
}

export function getTierEmoji(tier: GuardianTier): string {
  const emojiMap: Record<GuardianTier, string> = {
    COMMON: '⚔️',
    RARE: '🗡️',
    EPIC: '⚡',
    LEGENDARY: '👑',
    MYTHIC: '🐉',
  };
  return emojiMap[tier];
}

export function getTierDescription(tier: GuardianTier): string {
  const descriptions: Record<GuardianTier, string> = {
    COMMON: 'Common Guardian',
    RARE: 'Rare Guardian',
    EPIC: 'Epic Guardian',
    LEGENDARY: 'Legendary Guardian',
    MYTHIC: 'Mythic Guardian',
  };
  return descriptions[tier];
}

export function getTierPercentage(tier: GuardianTier): number {
  return Math.round((RARITY_CONFIG[tier] / TOTAL_GUARDIANS) * 100);
}

export function getTierColor(tier: GuardianTier): string {
  const colors: Record<GuardianTier, string> = {
    COMMON: 'bg-zinc-700',
    RARE: 'bg-blue-600',
    EPIC: 'bg-purple-600',
    LEGENDARY: 'bg-yellow-600',
    MYTHIC: 'bg-gradient-to-r from-pink-600 to-purple-600',
  };
  return colors[tier];
}

export function getTierTextColor(tier: GuardianTier): string {
  const colors: Record<GuardianTier, string> = {
    COMMON: 'text-zinc-100',
    RARE: 'text-blue-100',
    EPIC: 'text-purple-100',
    LEGENDARY: 'text-yellow-100',
    MYTHIC: 'text-white',
  };
  return colors[tier];
}
