import { Pool } from 'pg';
import { TopContributorEntry, LeaderboardResponse } from './types';

export async function getTopContributors(
  limit: number = 50,
  offset: number = 0,
  pool: Pool
): Promise<TopContributorEntry[]> {
  const result = await pool.query<any>(
    `SELECT
      ROW_NUMBER() OVER (ORDER BY ge.contribution_score DESC) as rank,
      ge.guardian_id,
      g.name,
      g.tier,
      ge.stage,
      ge.contribution_score,
      ge.level,
      ge.title,
      go.username,
      go.wallet_address
    FROM guardian_evolution ge
    JOIN guardian g ON ge.guardian_id = g.id
    LEFT JOIN guardian_ownership go ON ge.guardian_id = go.guardian_id
    ORDER BY ge.contribution_score DESC
    LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  return result.rows.map(row => ({
    rank: row.rank,
    guardianId: row.guardian_id,
    guardianName: row.name,
    guardianTier: row.tier,
    stage: row.stage,
    contributionScore: row.contribution_score,
    level: row.level,
    title: row.title,
    username: row.username || 'Unknown',
    walletAddress: row.wallet_address || 'Not linked'
  }));
}

export async function getLeaderboard(
  limit: number = 50,
  offset: number = 0,
  pool: Pool
): Promise<LeaderboardResponse> {
  const entries = await getTopContributors(limit, offset, pool);

  const totalResult = await pool.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM guardian_evolution`
  );
  const total = totalResult.rows[0]?.count || 0;

  return {
    entries,
    total,
    limit,
    offset
  };
}

export async function getGuardianRank(guardianId: number, pool: Pool): Promise<number | null> {
  const result = await pool.query<{ rank: number }>(
    `SELECT COUNT(*) + 1 as rank FROM guardian_evolution
     WHERE contribution_score > (
       SELECT contribution_score FROM guardian_evolution WHERE guardian_id = $1
     )`,
    [guardianId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0].rank;
}
