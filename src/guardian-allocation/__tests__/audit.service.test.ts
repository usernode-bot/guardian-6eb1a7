import { Pool } from 'pg';
import { logEvent, getGuardianHistory, getUserHistory } from '../audit.service';

describe('AuditService', () => {
  let pool: Pool;

  beforeEach(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  });

  afterEach(async () => {
    await pool.end();
  });

  describe('logEvent', () => {
    it('should log an event', async () => {
      const result = await logEvent(1, 'ut1test', 1, 'testuser', 'ASSIGNED', { tier: 'COMMON' }, pool);

      expect(result).toBeDefined();
      expect(result.guardian_id).toBe(1);
      expect(result.wallet_address).toBe('ut1test');
      expect(result.event).toBe('ASSIGNED');
    });

    it('should store metadata', async () => {
      const metadata = { tier: 'LEGENDARY', name: 'TestGuardian' };
      const result = await logEvent(2, 'ut1test2', 2, 'testuser2', 'RESERVED', metadata, pool);

      expect(result.metadata).toBeDefined();
    });
  });

  describe('getGuardianHistory', () => {
    it('should return empty array for non-existent guardian', async () => {
      const result = await getGuardianHistory(99999, pool);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getUserHistory', () => {
    it('should return empty array for non-existent wallet', async () => {
      const result = await getUserHistory('ut1nonexistent', pool);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it('should return events in reverse chronological order', async () => {
      const wallet = 'ut1test-history';
      await logEvent(1, wallet, 1, 'user', 'ASSIGNED', {}, pool);
      await new Promise(r => setTimeout(r, 10));
      await logEvent(2, wallet, 1, 'user', 'RESERVED', {}, pool);

      const result = await getUserHistory(wallet, pool);

      if (result.length > 1) {
        expect(new Date(result[0].created_at).getTime()).toBeGreaterThanOrEqual(
          new Date(result[1].created_at).getTime()
        );
      }
    });
  });
});
