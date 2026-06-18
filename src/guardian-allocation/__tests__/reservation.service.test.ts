import { Pool } from 'pg';
import { getActiveReservation, getRemainingTime, cleanupExpiredReservations, createReservationExpiresAt } from '../reservation.service';
import { GuardianReservation } from '../types';

describe('ReservationService', () => {
  let pool: Pool;

  beforeEach(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  });

  afterEach(async () => {
    await pool.end();
  });

  describe('getRemainingTime', () => {
    it('should return positive time for future expiry', () => {
      const futureDate = new Date(Date.now() + 60000);
      const reservation: GuardianReservation = {
        id: 1,
        guardian_id: 1,
        wallet_address: 'test',
        user_id: 1,
        username: 'test',
        expires_at: futureDate.toISOString(),
        created_at: new Date().toISOString(),
      };

      const remaining = getRemainingTime(reservation);

      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(60000);
    });

    it('should return 0 for expired reservation', () => {
      const pastDate = new Date(Date.now() - 60000);
      const reservation: GuardianReservation = {
        id: 1,
        guardian_id: 1,
        wallet_address: 'test',
        user_id: 1,
        username: 'test',
        expires_at: pastDate.toISOString(),
        created_at: new Date().toISOString(),
      };

      const remaining = getRemainingTime(reservation);

      expect(remaining).toBe(0);
    });
  });

  describe('createReservationExpiresAt', () => {
    it('should return a date 1 hour in the future', () => {
      const expiresAt = createReservationExpiresAt();
      const now = Date.now();
      const diff = expiresAt.getTime() - now;

      expect(diff).toBeGreaterThan(59 * 60 * 1000);
      expect(diff).toBeLessThanOrEqual(60 * 60 * 1000);
    });
  });

  describe('cleanupExpiredReservations', () => {
    it('should clean up expired reservations', async () => {
      const result = await cleanupExpiredReservations(pool);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getActiveReservation', () => {
    it('should return null for non-existent reservation', async () => {
      const result = await getActiveReservation(99999, pool);

      expect(result).toBeNull();
    });
  });
});
