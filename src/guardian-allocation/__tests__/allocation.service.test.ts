import { Pool } from 'pg';
import { RandomStrategy, BalancedTierStrategy, assignGuardian } from '../allocation.service';
import { Guardian } from '../types';

describe('AllocationService', () => {
  let pool: Pool;

  beforeEach(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  });

  afterEach(async () => {
    await pool.end();
  });

  describe('RandomStrategy', () => {
    it('should select a random guardian from available', () => {
      const guardians: Guardian[] = [
        { id: 1, name: 'Aegis', title: 'Guardian', tier: 'COMMON', lore: 'test', image: '⚔️', status: 'AVAILABLE', created_at: '' },
        { id: 2, name: 'Nyra', title: 'Guardian', tier: 'RARE', lore: 'test', image: '🗡️', status: 'AVAILABLE', created_at: '' },
      ];

      const strategy = new RandomStrategy();
      const selected = strategy.selectGuardian(guardians);

      expect(selected).toBeDefined();
      expect(guardians).toContainEqual(selected);
    });

    it('should return null for empty list', () => {
      const strategy = new RandomStrategy();
      const selected = strategy.selectGuardian([]);

      expect(selected).toBeNull();
    });
  });

  describe('BalancedTierStrategy', () => {
    it('should prefer higher tiers', () => {
      const guardians: Guardian[] = [
        { id: 1, name: 'Aegis', title: 'Guardian', tier: 'COMMON', lore: 'test', image: '⚔️', status: 'AVAILABLE', created_at: '' },
        { id: 2, name: 'Mythic', title: 'Guardian', tier: 'MYTHIC', lore: 'test', image: '🐉', status: 'AVAILABLE', created_at: '' },
      ];

      const strategy = new BalancedTierStrategy();
      let selectedMythic = false;

      for (let i = 0; i < 10; i++) {
        const selected = strategy.selectGuardian(guardians);
        if (selected?.tier === 'MYTHIC') {
          selectedMythic = true;
          break;
        }
      }

      expect(selectedMythic).toBe(true);
    });

    it('should return null for empty list', () => {
      const strategy = new BalancedTierStrategy();
      const selected = strategy.selectGuardian([]);

      expect(selected).toBeNull();
    });
  });

  describe('assignGuardian', () => {
    it('should assign a guardian and create reservation', async () => {
      const wallet = 'ut1testuser';
      const userId = 1;
      const username = 'testuser';

      const result = await assignGuardian(wallet, userId, username, new RandomStrategy(), pool);

      expect(result).toBeDefined();
      expect(result?.guardian).toBeDefined();
      expect(result?.guardian.status).toBe('AVAILABLE');
      expect(result?.reservation).toBeDefined();
      expect(result?.reservation.wallet_address).toBe(wallet);
    });

    it('should return null for invalid wallet', async () => {
      const wallet = 'invalid-wallet';
      const result = await assignGuardian(wallet, 1, 'user', new RandomStrategy(), pool);

      expect(result).toBeNull();
    });
  });
});
