import { Pool } from 'pg';
import { ContributionMetrics, GuardianEvolution } from './types';

export function calculateContributionScore(metrics: ContributionMetrics): number {
  const { fgHours, peerCount, uptime } = metrics;

  if (fgHours < 0 || peerCount < 0 || uptime < 0 || uptime > 100) {
    return 0;
  }

  const score = (fgHours * 40) + (peerCount * 20) + (uptime * 40);
  return Math.round(score);
}

export async function recalculateScoreForGuardian(
  guardianId: number,
  metrics: ContributionMetrics,
  pool: Pool
): Promise<number> {
  const newScore = calculateContributionScore(metrics);

  const result = await pool.query<GuardianEvolution>(
    `INSERT INTO guardian_evolution (guardian_id, contribution_score, level, stage, last_score_recalc_at)
     VALUES ($1, $2, 1, 'INITIATE', NOW())
     ON CONFLICT (guardian_id) DO UPDATE
     SET contribution_score = $2, last_score_recalc_at = NOW()
     RETURNING *`,
    [guardianId, newScore]
  );

  return result.rows[0].contribution_score;
}
