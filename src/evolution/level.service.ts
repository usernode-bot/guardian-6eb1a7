import { LEVEL_THRESHOLDS } from './constants';

export function calculateLevel(score: number): number {
  if (score < 0) return 1;

  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    const threshold = LEVEL_THRESHOLDS[i];
    if (score >= threshold.minScore) {
      return threshold.level;
    }
  }

  return 1;
}

export function getLevelThreshold(level: number): { minScore: number; maxScore: number } {
  const threshold = LEVEL_THRESHOLDS.find(t => t.level === level);
  if (!threshold) {
    throw new Error(`Unknown level: ${level}`);
  }
  return { minScore: threshold.minScore, maxScore: threshold.maxScore };
}

export function checkLevelProgression(
  oldScore: number,
  newScore: number
): { levelChanged: boolean; oldLevel: number; newLevel: number } {
  const oldLevel = calculateLevel(oldScore);
  const newLevel = calculateLevel(newScore);
  return {
    levelChanged: oldLevel !== newLevel,
    oldLevel,
    newLevel
  };
}
