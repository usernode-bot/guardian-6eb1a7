import { Pool } from 'pg';
import { GuardianAuditLog, AuditEvent } from './types';

export async function logEvent(
  guardianId: number,
  wallet: string,
  userId: number,
  username: string,
  event: AuditEvent,
  metadata?: Record<string, any>,
  pool?: Pool
): Promise<GuardianAuditLog> {
  const globalPool = pool || new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const result = await globalPool.query<GuardianAuditLog>(
      `INSERT INTO guardian_audit_log (guardian_id, wallet_address, user_id, username, event, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [guardianId, wallet, userId, username, event, metadata ? JSON.stringify(metadata) : null]
    );

    return result.rows[0];
  } finally {
    if (!pool) await globalPool.end();
  }
}

export async function getGuardianHistory(guardianId: number, pool?: Pool): Promise<GuardianAuditLog[]> {
  const globalPool = pool || new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const result = await globalPool.query<GuardianAuditLog>(
      `SELECT * FROM guardian_audit_log WHERE guardian_id = $1 ORDER BY created_at ASC`,
      [guardianId]
    );

    return result.rows;
  } finally {
    if (!pool) await globalPool.end();
  }
}

export async function getUserHistory(wallet: string, pool?: Pool): Promise<GuardianAuditLog[]> {
  const globalPool = pool || new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const result = await globalPool.query<GuardianAuditLog>(
      `SELECT * FROM guardian_audit_log WHERE wallet_address = $1 ORDER BY created_at DESC`,
      [wallet]
    );

    return result.rows;
  } finally {
    if (!pool) await globalPool.end();
  }
}
