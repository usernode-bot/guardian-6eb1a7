import { EvolutionStage, TraitConfig } from './types';
import { TRAIT_CONFIGS } from './constants';
import { calculateStage } from './stages.service';

export function getTraitsForStage(stage: EvolutionStage): TraitConfig {
  const traits = TRAIT_CONFIGS[stage];
  if (!traits) {
    throw new Error(`Unknown stage: ${stage}`);
  }
  return { ...traits };
}

export function getTraitsForScore(score: number): TraitConfig {
  const stage = calculateStage(score);
  return getTraitsForStage(stage);
}
