import { Pool } from 'pg';
import { getGuardianByWallet, getOwnershipByWallet, recordOwnership, isMinted, listOwnedGuardians } from '../ownership.service';
import { Guardian } from '../types';

describe('OwnershipService', () => {
  let pool: Pool;

  beforeEach(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  });

  afterEach(async () => {
    await pool.end();
  });

  describe('getOwnershipByWallet', () => {
    it('should return null for non-existent wallet', async () => {
      const result = await getOwnershipByWallet('ut1nonexistent', pool);

      expect(result).toBeNull();
    });
  });

  describe('recordOwnership', () => {
    it('should create an ownership record', async () => {
      const guardian: Guardian = {
        id: 1,
        name: 'Aegis',
        title: 'Guardian',
        tier: 'COMMON',
        lore: 'test',
        image: '⚔️',
        status: 'AVAILABLE',
        created_at: new Date().toISOString(),
      };

      const result = await recordOwnership(guardian, 'ut1test', 1, 'testuser', pool);

      expect(result).toBeDefined();
      expect(result.guardian_id).toBe(1);
      expect(result.wallet_address).toBe('ut1test');
      expect(result.user_id).toBe(1);
    });
  });

  describe('isMinted', () => {
    it('should return false for unminted guardian', async () => {
      const result = await isMinted(1, pool);

      expect(result).toBe(false);
    });
  });

  describe('listOwnedGuardians', () => {
    it('should return empty array for wallet with no minted guardians', async () => {
      const result = await listOwnedGuardians('ut1nonexistent', pool);

      expect(result).toEqual([]);
    });
  });
});
