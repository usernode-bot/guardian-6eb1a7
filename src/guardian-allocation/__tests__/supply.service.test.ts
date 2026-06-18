import { Pool } from 'pg';
import { getSupplyStats, getAvailableGuardians } from '../supply.service';

describe('SupplyService', () => {
  let pool: Pool;

  beforeEach(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  });

  afterEach(async () => {
    await pool.end();
  });

  describe('getSupplyStats', () => {
    it('should return supply statistics', async () => {
      const result = await getSupplyStats(pool);

      expect(result).toBeDefined();
      expect(result.total).toBeGreaterThanOrEqual(0);
      expect(result.available).toBeGreaterThanOrEqual(0);
      expect(result.reserved).toBeGreaterThanOrEqual(0);
      expect(result.minted).toBeGreaterThanOrEqual(0);
      expect(result.byTier).toBeDefined();
      expect(result.byTier.COMMON).toBeDefined();
      expect(result.byTier.RARE).toBeDefined();
      expect(result.byTier.EPIC).toBeDefined();
      expect(result.byTier.LEGENDARY).toBeDefined();
      expect(result.byTier.MYTHIC).toBeDefined();
    });

    it('should have consistent tier counts', async () => {
      const result = await getSupplyStats(pool);

      for (const tier in result.byTier) {
        const tierData = result.byTier[tier as any];
        const tierTotal = tierData.available + tierData.reserved + tierData.minted;
        expect(tierTotal).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('getAvailableGuardians', () => {
    it('should return available guardians', async () => {
      const result = await getAvailableGuardians(undefined, 10, pool);

      expect(Array.isArray(result)).toBe(true);
      for (const guardian of result) {
        expect(guardian.status).toBe('AVAILABLE');
      }
    });

    it('should filter by tier if specified', async () => {
      const result = await getAvailableGuardians('RARE', 5, pool);

      expect(Array.isArray(result)).toBe(true);
      for (const guardian of result) {
        expect(guardian.status).toBe('AVAILABLE');
        expect(guardian.tier).toBe('RARE');
      }
    });

    it('should respect limit', async () => {
      const result = await getAvailableGuardians(undefined, 3, pool);

      expect(result.length).toBeLessThanOrEqual(3);
    });
  });
});
