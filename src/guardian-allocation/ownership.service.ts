import { Pool } from 'pg';
import { Guardian, GuardianOwnership } from './types';
import { cleanupExpiredReservations } from './reservation.service';

export async function getGuardianByWallet(wallet: string, pool?: Pool): Promise<Guardian | null> {
  const globalPool = pool || new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    await cleanupExpiredReservations(globalPool);

    const result = await globalPool.query<Guardian>(
      `SELECT g.* FROM guardian g
       LEFT JOIN guardian_ownership go ON g.id = go.guardian_id
       LEFT JOIN guardian_reservation gr ON g.id = gr.guardian_id
       WHERE (go.wallet_address = $1 AND go.minted_at IS NULL)
          OR (gr.wallet_address = $1 AND gr.expires_at > NOW())
       LIMIT 1`,
      [wallet]
    );

    return result.rows[0] || null;
  } finally {
    if (!pool) await globalPool.end();
  }
}

export async function getOwnershipByWallet(wallet: string, pool?: Pool): Promise<GuardianOwnership | null> {
  const globalPool = pool || new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const result = await globalPool.query<GuardianOwnership>(
      `SELECT * FROM guardian_ownership WHERE wallet_address = $1 LIMIT 1`,
      [wallet]
    );

    return result.rows[0] || null;
  } finally {
    if (!pool) await globalPool.end();
  }
}

export async function recordOwnership(
  guardian: Guardian,
  wallet: string,
  userId: number,
  username: string,
  pool?: Pool
): Promise<GuardianOwnership> {
  const globalPool = pool || new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const result = await globalPool.query<GuardianOwnership>(
      `INSERT INTO guardian_ownership (guardian_id, wallet_address, user_id, username)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (guardian_id) DO UPDATE SET updated_at = NOW() RETURNING *`,
      [guardian.id, wallet, userId, username]
    );

    return result.rows[0];
  } finally {
    if (!pool) await globalPool.end();
  }
}

export async function isMinted(guardianId: number, pool?: Pool): Promise<boolean> {
  const globalPool = pool || new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const result = await globalPool.query<{ minted_at: string | null }>(
      `SELECT minted_at FROM guardian_ownership WHERE guardian_id = $1`,
      [guardianId]
    );

    if (result.rows.length === 0) return false;
    return result.rows[0].minted_at !== null;
  } finally {
    if (!pool) await globalPool.end();
  }
}

export async function listOwnedGuardians(wallet: string, pool?: Pool): Promise<Guardian[]> {
  const globalPool = pool || new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const result = await globalPool.query<Guardian>(
      `SELECT g.* FROM guardian g
       JOIN guardian_ownership go ON g.id = go.guardian_id
       WHERE go.wallet_address = $1 AND go.minted_at IS NOT NULL
       ORDER BY go.created_at DESC`,
      [wallet]
    );

    return result.rows;
  } finally {
    if (!pool) await globalPool.end();
  }
}
