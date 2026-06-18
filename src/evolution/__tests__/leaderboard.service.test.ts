import { Pool } from 'pg';
import { getLeaderboard, getGuardianRank } from '../leaderboard.service';

describe('LeaderboardService', () => {
  let pool: Pool;

  beforeAll(() => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM guardian_evolution_history');
    await pool.query('DELETE FROM guardian_evolution');
    await pool.query('DELETE FROM guardian_ownership');
    await pool.query('DELETE FROM guardian_reservation');
    await pool.query('DELETE FROM guardian_audit_log');
    await pool.query('DELETE FROM guardian');
  });

  describe('getLeaderboard', () => {
    it('should return empty leaderboard when no guardians have evolution records', async () => {
      const result = await getLeaderboard(50, 0, pool);
      expect(result.entries).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should return leaderboard with correct ranking order', async () => {
      for (let i = 1; i <= 5; i++) {
        await pool.query(
          `INSERT INTO guardian (id, name, title, tier, lore, image) VALUES ($1, $2, $3, $4, $5, $6)`,
          [i, `Guardian ${i}`, 'Test Title', 'COMMON', 'Test Lore', '⚔️']
        );
        await pool.query(
          `INSERT INTO guardian_evolution (guardian_id, contribution_score, level, stage, title, aura, armor_tier, weapon_tier)
           VALUES ($1, $2, 1, 'INITIATE', 'Node Wanderer', 'Gray Aura', 'Novice Leather', 'Wooden Staff')`,
          [i, i * 100]
        );
      }

      const result = await getLeaderboard(50, 0, pool);
      expect(result.entries).toHaveLength(5);
      expect(result.total).toBe(5);
      expect(result.entries[0].contributionScore).toBeGreaterThan(result.entries[4].contributionScore);
      expect(result.entries[0].rank).toBe(1);
      expect(result.entries[4].rank).toBe(5);
    });

    it('should respect limit and offset', async () => {
      for (let i = 1; i <= 10; i++) {
        await pool.query(
          `INSERT INTO guardian (id, name, title, tier, lore, image) VALUES ($1, $2, $3, $4, $5, $6)`,
          [i, `Guardian ${i}`, 'Test Title', 'COMMON', 'Test Lore', '⚔️']
        );
        await pool.query(
          `INSERT INTO guardian_evolution (guardian_id, contribution_score, level, stage, title, aura, armor_tier, weapon_tier)
           VALUES ($1, $2, 1, 'INITIATE', 'Node Wanderer', 'Gray Aura', 'Novice Leather', 'Wooden Staff')`,
          [i, i * 100]
        );
      }

      const page1 = await getLeaderboard(3, 0, pool);
      expect(page1.entries).toHaveLength(3);
      expect(page1.total).toBe(10);

      const page2 = await getLeaderboard(3, 3, pool);
      expect(page2.entries).toHaveLength(3);
      expect(page2.entries[0].rank).toBeGreaterThan(page1.entries[page1.entries.length - 1].rank);
    });
  });

  describe('getGuardianRank', () => {
    it('should return null for guardian without evolution record', async () => {
      const rank = await getGuardianRank(999, pool);
      expect(rank).toBeNull();
    });

    it('should return correct rank for guardian', async () => {
      for (let i = 1; i <= 5; i++) {
        await pool.query(
          `INSERT INTO guardian (id, name, title, tier, lore, image) VALUES ($1, $2, $3, $4, $5, $6)`,
          [i, `Guardian ${i}`, 'Test Title', 'COMMON', 'Test Lore', '⚔️']
        );
        await pool.query(
          `INSERT INTO guardian_evolution (guardian_id, contribution_score, level, stage, title, aura, armor_tier, weapon_tier)
           VALUES ($1, $2, 1, 'INITIATE', 'Node Wanderer', 'Gray Aura', 'Novice Leather', 'Wooden Staff')`,
          [i, i * 100]
        );
      }

      const rank1 = await getGuardianRank(5, pool);
      expect(rank1).toBe(1);

      const rank5 = await getGuardianRank(1, pool);
      expect(rank5).toBe(5);
    });
  });
});
