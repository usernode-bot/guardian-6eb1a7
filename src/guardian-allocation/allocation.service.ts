import { Pool } from 'pg';
import { Guardian, GuardianTier, AllocationStrategy, AssignGuardianResult, GuardianReservation } from './types';
import { cleanupExpiredReservations, createReservationExpiresAt } from './reservation.service';
import { getAvailableGuardians } from './supply.service';
import { getWalletRegistry } from './wallet-registry.service';
import { logEvent } from './audit.service';

export class RandomStrategy implements AllocationStrategy {
  selectGuardian(availableGuardians: Guardian[]): Guardian | null {
    if (availableGuardians.length === 0) return null;
    const index = Math.floor(Math.random() * availableGuardians.length);
    return availableGuardians[index];
  }
}

export class BalancedTierStrategy implements AllocationStrategy {
  selectGuardian(availableGuardians: Guardian[]): Guardian | null {
    if (availableGuardians.length === 0) return null;

    const byTier: Record<GuardianTier, Guardian[]> = {
      COMMON: [],
      RARE: [],
      EPIC: [],
      LEGENDARY: [],
      MYTHIC: [],
    };

    for (const guardian of availableGuardians) {
      byTier[guardian.tier].push(guardian);
    }

    const tiers: GuardianTier[] = ['MYTHIC', 'LEGENDARY', 'EPIC', 'RARE', 'COMMON'];
    for (const tier of tiers) {
      if (byTier[tier].length > 0) {
        const index = Math.floor(Math.random() * byTier[tier].length);
        return byTier[tier][index];
      }
    }

    return null;
  }
}

export async function assignGuardian(
  wallet: string,
  userId: number,
  username: string,
  strategy: AllocationStrategy = new RandomStrategy(),
  pool?: Pool
): Promise<AssignGuardianResult | null> {
  const globalPool = pool || new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const walletRegistry = getWalletRegistry();
    const isValid = await walletRegistry.isValid(wallet);
    if (!isValid) {
      return null;
    }

    await cleanupExpiredReservations(globalPool);

    const available = await getAvailableGuardians(undefined, undefined, globalPool);
    const selected = strategy.selectGuardian(available);

    if (!selected) {
      return null;
    }

    const expiresAt = createReservationExpiresAt();

    const client = await globalPool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE guardian SET status = 'RESERVED' WHERE id = $1`,
        [selected.id]
      );

      const reservationResult = await client.query<GuardianReservation>(
        `INSERT INTO guardian_reservation (guardian_id, wallet_address, user_id, username, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [selected.id, wallet, userId, username, expiresAt]
      );

      const reservation = reservationResult.rows[0];

      await logEvent(
        selected.id,
        wallet,
        userId,
        username,
        'ASSIGNED',
        { tier: selected.tier, name: selected.name },
        globalPool
      );

      await logEvent(
        selected.id,
        wallet,
        userId,
        username,
        'RESERVED',
        { expiresAt: expiresAt.toISOString(), durationMs: 60 * 60 * 1000 },
        globalPool
      );

      await client.query('COMMIT');

      return { guardian: selected, reservation };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } finally {
    if (!pool) await globalPool.end();
  }
}

export async function listReservationsByWallet(wallet: string, pool?: Pool): Promise<GuardianReservation[]> {
  const globalPool = pool || new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const result = await globalPool.query<GuardianReservation>(
      `SELECT * FROM guardian_reservation WHERE wallet_address = $1 AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [wallet]
    );

    return result.rows;
  } finally {
    if (!pool) await globalPool.end();
  }
}
