import { EvolutionStage, StageThreshold, TitleThreshold, TraitConfig } from './types';

export const STAGE_THRESHOLDS: StageThreshold[] = [
  { stage: 'INITIATE', minScore: 0, maxScore: 100 },
  { stage: 'AWAKENED', minScore: 101, maxScore: 250 },
  { stage: 'ASCENDANT', minScore: 251, maxScore: 500 },
  { stage: 'GUARDIAN', minScore: 501, maxScore: 1000 },
  { stage: 'MYTHIC', minScore: 1001, maxScore: Infinity }
];

export const LEVEL_THRESHOLDS = [
  { level: 1, minScore: 0, maxScore: 100 },
  { level: 2, minScore: 101, maxScore: 250 },
  { level: 3, minScore: 251, maxScore: 500 },
  { level: 4, minScore: 501, maxScore: 1000 },
  { level: 5, minScore: 1001, maxScore: 2000 },
  { level: 6, minScore: 2001, maxScore: 3500 },
  { level: 7, minScore: 3501, maxScore: 5000 },
  { level: 8, minScore: 5001, maxScore: 7500 },
  { level: 9, minScore: 7501, maxScore: 10000 },
  { level: 10, minScore: 10001, maxScore: Infinity }
];

export const TITLE_THRESHOLDS: TitleThreshold[] = [
  { title: 'Node Wanderer', minScore: 0, maxScore: 100 },
  { title: 'Network Scout', minScore: 101, maxScore: 250 },
  { title: 'Protocol Guardian', minScore: 251, maxScore: 500 },
  { title: 'Core Defender', minScore: 501, maxScore: 1000 },
  { title: 'Legend Keeper', minScore: 1001, maxScore: Infinity }
];

export const TRAIT_CONFIGS: Record<EvolutionStage, TraitConfig> = {
  INITIATE: {
    stage: 'INITIATE',
    aura: 'Gray Aura',
    armorTier: 'Novice Leather',
    weaponTier: 'Wooden Staff',
    emoji: '🌱'
  },
  AWAKENED: {
    stage: 'AWAKENED',
    aura: 'Blue Aura',
    armorTier: 'Apprentice Chain',
    weaponTier: 'Iron Sword',
    emoji: '💙'
  },
  ASCENDANT: {
    stage: 'ASCENDANT',
    aura: 'Gold Aura',
    armorTier: 'Knight Plate',
    weaponTier: 'Enchanted Blade',
    emoji: '✨'
  },
  GUARDIAN: {
    stage: 'GUARDIAN',
    aura: 'Plasma Aura',
    armorTier: 'Celestial Armor',
    weaponTier: 'Plasma Sword',
    emoji: '⚡'
  },
  MYTHIC: {
    stage: 'MYTHIC',
    aura: 'Celestial Aura',
    armorTier: 'Legendary Divinity Plate',
    weaponTier: 'Cosmic Spear',
    emoji: '🔮'
  }
};
