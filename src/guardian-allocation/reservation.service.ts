import { Pool } from 'pg';
import { GuardianReservation } from './types';
import { logEvent } from './audit.service';

const RESERVATION_DURATION_MS = 60 * 60 * 1000; // 1 hour

export async function getActiveReservation(
  guardianId: number,
  pool?: Pool
): Promise<GuardianReservation | null> {
  const globalPool = pool || new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const result = await globalPool.query<GuardianReservation>(
      `SELECT * FROM guardian_reservation
       WHERE guardian_id = $1 AND expires_at > NOW()
       LIMIT 1`,
      [guardianId]
    );

    return result.rows[0] || null;
  } finally {
    if (!pool) await globalPool.end();
  }
}

export function getRemainingTime(reservation: GuardianReservation): number {
  const expiresAt = new Date(reservation.expires_at).getTime();
  const now = Date.now();
  return Math.max(0, expiresAt - now);
}

export async function cleanupExpiredReservations(pool?: Pool): Promise<GuardianReservation[]> {
  const globalPool = pool || new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const client = await globalPool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query<GuardianReservation>(
        `SELECT * FROM guardian_reservation WHERE expires_at < NOW()`
      );

      const expired = result.rows;

      for (const reservation of expired) {
        await client.query(
          `UPDATE guardian SET status = 'AVAILABLE' WHERE id = $1`,
          [reservation.guardian_id]
        );

        await client.query(
          `DELETE FROM guardian_reservation WHERE id = $1`,
          [reservation.id]
        );

        await logEvent(
          reservation.guardian_id,
          reservation.wallet_address,
          reservation.user_id,
          reservation.username,
          'EXPIRED',
          { expiresAt: reservation.expires_at },
          globalPool
        );

        await logEvent(
          reservation.guardian_id,
          reservation.wallet_address,
          reservation.user_id,
          reservation.username,
          'RELEASED',
          { reason: 'reservation_expired' },
          globalPool
        );
      }

      await client.query('COMMIT');
      return expired;
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

export async function cancelReservation(guardianId: number, pool?: Pool): Promise<boolean> {
  const globalPool = pool || new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const result = await globalPool.query(
      `DELETE FROM guardian_reservation WHERE guardian_id = $1 RETURNING *`,
      [guardianId]
    );

    if (result.rows.length > 0) {
      const reservation = result.rows[0];
      await globalPool.query(
        `UPDATE guardian SET status = 'AVAILABLE' WHERE id = $1`,
        [guardianId]
      );

      await logEvent(
        guardianId,
        reservation.wallet_address,
        reservation.user_id,
        reservation.username,
        'RELEASED',
        { reason: 'manual_cancellation' },
        globalPool
      );

      return true;
    }

    return false;
  } finally {
    if (!pool) await globalPool.end();
  }
}

export function createReservationExpiresAt(): Date {
  return new Date(Date.now() + RESERVATION_DURATION_MS);
}
