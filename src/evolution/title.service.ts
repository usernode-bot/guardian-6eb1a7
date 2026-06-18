import { TITLE_THRESHOLDS } from './constants';

export function calculateTitle(score: number): string {
  if (score < 0) return '';

  for (let i = TITLE_THRESHOLDS.length - 1; i >= 0; i--) {
    const threshold = TITLE_THRESHOLDS[i];
    if (score >= threshold.minScore) {
      return threshold.title;
    }
  }

  return '';
}

export function getTitleThreshold(title: string): { minScore: number; maxScore: number } | null {
  const threshold = TITLE_THRESHOLDS.find(t => t.title === title);
  if (!threshold) {
    return null;
  }
  return { minScore: threshold.minScore, maxScore: threshold.maxScore };
}
