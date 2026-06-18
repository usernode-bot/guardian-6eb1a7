import { Pool } from 'pg';
import { getEvolution, updateEvolution } from '../evolution.service';

describe('EvolutionService', () => {
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

  describe('updateEvolution', () => {
    it('should create new evolution record for guardian without one', async () => {
      await pool.query(
        `INSERT INTO guardian (id, name, title, tier, lore, image) VALUES ($1, $2, $3, $4, $5, $6)`,
        [1, 'Test Guardian', 'Test Title', 'COMMON', 'Test Lore', '⚔️']
      );

      const result = await updateEvolution(1, { fgHours: 10, peerCount: 5, uptime: 80 }, pool);

      expect(result.guardianId).toBe(1);
      expect(result.oldScore).toBe(0);
      expect(result.newScore).toBeGreaterThan(0);
      expect(result.oldStage).toBe('INITIATE');
      expect(result.newStage).toBe('INITIATE');
    });

    it('should update evolution score correctly', async () => {
      await pool.query(
        `INSERT INTO guardian (id, name, title, tier, lore, image) VALUES ($1, $2, $3, $4, $5, $6)`,
        [1, 'Test Guardian', 'Test Title', 'COMMON', 'Test Lore', '⚔️']
      );

      const result1 = await updateEvolution(1, { fgHours: 5, peerCount: 2, uptime: 50 }, pool);
      const score1 = result1.newScore;

      const result2 = await updateEvolution(1, { fgHours: 10, peerCount: 5, uptime: 80 }, pool);
      const score2 = result2.newScore;

      expect(score2).toBeGreaterThan(score1);
    });

    it('should detect stage change', async () => {
      await pool.query(
        `INSERT INTO guardian (id, name, title, tier, lore, image) VALUES ($1, $2, $3, $4, $5, $6)`,
        [1, 'Test Guardian', 'Test Title', 'COMMON', 'Test Lore', '⚔️']
      );

      const result1 = await updateEvolution(1, { fgHours: 2, peerCount: 1, uptime: 10 }, pool);
      expect(result1.newStage).toBe('INITIATE');

      const result2 = await updateEvolution(1, { fgHours: 5, peerCount: 20, uptime: 60 }, pool);
      expect(result2.stageChanged).toBe(true);
      expect(result2.newStage).toBe('AWAKENED');
    });

    it('should track evolution history on stage change', async () => {
      await pool.query(
        `INSERT INTO guardian (id, name, title, tier, lore, image) VALUES ($1, $2, $3, $4, $5, $6)`,
        [1, 'Test Guardian', 'Test Title', 'COMMON', 'Test Lore', '⚔️']
      );

      await updateEvolution(1, { fgHours: 2, peerCount: 1, uptime: 10 }, pool);
      await updateEvolution(1, { fgHours: 5, peerCount: 20, uptime: 60 }, pool);

      const historyResult = await pool.query('SELECT * FROM guardian_evolution_history WHERE guardian_id = $1', [1]);
      expect(historyResult.rows.length).toBeGreaterThan(0);
    });
  });

  describe('getEvolution', () => {
    it('should return null for guardian without evolution record', async () => {
      const evolution = await getEvolution(999, pool);
      expect(evolution).toBeNull();
    });

    it('should return evolution record for guardian with one', async () => {
      await pool.query(
        `INSERT INTO guardian (id, name, title, tier, lore, image) VALUES ($1, $2, $3, $4, $5, $6)`,
        [1, 'Test Guardian', 'Test Title', 'COMMON', 'Test Lore', '⚔️']
      );

      await updateEvolution(1, { fgHours: 10, peerCount: 5, uptime: 80 }, pool);

      const evolution = await getEvolution(1, pool);
      expect(evolution).not.toBeNull();
      expect(evolution?.guardian_id).toBe(1);
      expect(evolution?.contribution_score).toBeGreaterThan(0);
    });
  });
});
