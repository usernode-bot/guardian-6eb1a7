import { Pool } from 'pg';
import { Guardian, GuardianTier, SupplyStats } from './types';
import { cleanupExpiredReservations } from './reservation.service';

export async function getSupplyStats(pool?: Pool): Promise<SupplyStats> {
  const globalPool = pool || new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    await cleanupExpiredReservations(globalPool);

    const result = await globalPool.query<{
      tier: GuardianTier;
      status: string;
      count: number;
    }>(
      `SELECT tier, status, COUNT(*) as count FROM guardian
       GROUP BY tier, status`
    );

    const tiers: GuardianTier[] = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC'];
    const byTier: Record<GuardianTier, { available: number; reserved: number; minted: number }> = {
      COMMON: { available: 0, reserved: 0, minted: 0 },
      RARE: { available: 0, reserved: 0, minted: 0 },
      EPIC: { available: 0, reserved: 0, minted: 0 },
      LEGENDARY: { available: 0, reserved: 0, minted: 0 },
      MYTHIC: { available: 0, reserved: 0, minted: 0 },
    };

    let total = 0;
    let available = 0;
    let reserved = 0;
    let minted = 0;

    for (const row of result.rows) {
      const count = parseInt(row.count.toString());
      total += count;

      if (row.status === 'AVAILABLE') {
        available += count;
        byTier[row.tier].available += count;
      } else if (row.status === 'RESERVED') {
        reserved += count;
        byTier[row.tier].reserved += count;
      } else if (row.status === 'MINTED') {
        minted += count;
        byTier[row.tier].minted += count;
      }
    }

    return { total, available, reserved, minted, byTier };
  } finally {
    if (!pool) await globalPool.end();
  }
}

export async function getAvailableGuardians(
  tier?: GuardianTier,
  limit?: number,
  pool?: Pool
): Promise<Guardian[]> {
  const globalPool = pool || new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    let query = `SELECT * FROM guardian WHERE status = 'AVAILABLE'`;
    const params: any[] = [];

    if (tier) {
      query += ` AND tier = $1`;
      params.push(tier);
    }

    query += ` ORDER BY RANDOM()`;

    if (limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(limit);
    }

    const result = await globalPool.query<Guardian>(query, params);
    return result.rows;
  } finally {
    if (!pool) await globalPool.end();
  }
}
