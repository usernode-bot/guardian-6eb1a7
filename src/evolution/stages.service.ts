import { EvolutionStage } from './types';
import { STAGE_THRESHOLDS } from './constants';

export function calculateStage(score: number): EvolutionStage {
  if (score < 0) throw new Error('Score must be non-negative');

  for (let i = STAGE_THRESHOLDS.length - 1; i >= 0; i--) {
    const threshold = STAGE_THRESHOLDS[i];
    if (score >= threshold.minScore) {
      return threshold.stage;
    }
  }

  return 'INITIATE';
}

export function getStageThreshold(stage: EvolutionStage): { minScore: number; maxScore: number } {
  const threshold = STAGE_THRESHOLDS.find(t => t.stage === stage);
  if (!threshold) {
    throw new Error(`Unknown stage: ${stage}`);
  }
  return { minScore: threshold.minScore, maxScore: threshold.maxScore };
}

export function checkStageProgression(
  oldScore: number,
  newScore: number
): { stageChanged: boolean; oldStage: EvolutionStage; newStage: EvolutionStage } {
  const oldStage = calculateStage(oldScore);
  const newStage = calculateStage(newScore);
  return {
    stageChanged: oldStage !== newStage,
    oldStage,
    newStage
  };
}
