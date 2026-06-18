const RARITY_CONFIG = {
  COMMON: 300,
  RARE: 120,
  EPIC: 60,
  LEGENDARY: 18,
  MYTHIC: 2,
};

const TOTAL_GUARDIANS = 500;

function getTierByIndex(index) {
  if (index < 300) return 'COMMON';
  if (index < 420) return 'RARE';
  if (index < 480) return 'EPIC';
  if (index < 498) return 'LEGENDARY';
  return 'MYTHIC';
}

function getTierEmoji(tier) {
  const emojiMap = {
    COMMON: '⚔️',
    RARE: '🗡️',
    EPIC: '⚡',
    LEGENDARY: '👑',
    MYTHIC: '🐉',
  };
  return emojiMap[tier];
}

function getTierDescription(tier) {
  const descriptions = {
    COMMON: 'Common Guardian',
    RARE: 'Rare Guardian',
    EPIC: 'Epic Guardian',
    LEGENDARY: 'Legendary Guardian',
    MYTHIC: 'Mythic Guardian',
  };
  return descriptions[tier];
}

function getTierPercentage(tier) {
  return Math.round((RARITY_CONFIG[tier] / TOTAL_GUARDIANS) * 100);
}

function getTierColor(tier) {
  const colors = {
    COMMON: 'bg-zinc-700',
    RARE: 'bg-blue-600',
    EPIC: 'bg-purple-600',
    LEGENDARY: 'bg-yellow-600',
    MYTHIC: 'bg-gradient-to-r from-pink-600 to-purple-600',
  };
  return colors[tier];
}

function getTierTextColor(tier) {
  const colors = {
    COMMON: 'text-zinc-100',
    RARE: 'text-blue-100',
    EPIC: 'text-purple-100',
    LEGENDARY: 'text-yellow-100',
    MYTHIC: 'text-white',
  };
  return colors[tier];
}

module.exports = {
  RARITY_CONFIG,
  TOTAL_GUARDIANS,
  getTierByIndex,
  getTierEmoji,
  getTierDescription,
  getTierPercentage,
  getTierColor,
  getTierTextColor
};
