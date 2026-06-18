import { Pool } from 'pg';
import { ContributionMetrics, GuardianEvolution, EvolutionUpdateResult, EvolutionStage } from './types';
import { calculateContributionScore, recalculateScoreForGuardian } from './score.service';
import { checkLevelProgression } from './level.service';
import { checkStageProgression, calculateStage } from './stages.service';
import { calculateTitle } from './title.service';
import { getTraitsForStage } from './traits.service';

export async function getEvolution(guardianId: number, pool: Pool): Promise<GuardianEvolution | null> {
  const result = await pool.query<GuardianEvolution>(
    `SELECT * FROM guardian_evolution WHERE guardian_id = $1`,
    [guardianId]
  );

  return result.rows[0] || null;
}

export async function updateEvolution(
  guardianId: number,
  metrics: ContributionMetrics,
  pool: Pool
): Promise<EvolutionUpdateResult> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let evolution = await getEvolutionInternal(guardianId, client);
    const oldScore = evolution?.contribution_score || 0;
    const oldLevel = evolution?.level || 1;
    const oldStage = evolution?.stage || 'INITIATE';
    const oldTitle = evolution?.title || '';

    const newScore = calculateContributionScore(metrics);
    const { levelChanged, oldLevel: calcOldLevel, newLevel } = checkLevelProgression(oldScore, newScore);
    const { stageChanged, oldStage: calcOldStage, newStage } = checkStageProgression(oldScore, newScore);
    const newTitle = calculateTitle(newScore);
    const titleChanged = oldTitle !== newTitle;

    const traits = getTraitsForStage(newStage);

    if (!evolution) {
      await client.query(
        `INSERT INTO guardian_evolution (
          guardian_id, contribution_score, level, stage, title, aura, armor_tier, weapon_tier, last_score_recalc_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [guardianId, newScore, newLevel, newStage, newTitle, traits.aura, traits.armorTier, traits.weaponTier]
      );
    } else {
      await client.query(
        `UPDATE guardian_evolution
         SET contribution_score = $2, level = $3, stage = $4, title = $5,
             aura = $6, armor_tier = $7, weapon_tier = $8, last_score_recalc_at = NOW(), updated_at = NOW()
         WHERE guardian_id = $1`,
        [guardianId, newScore, newLevel, newStage, newTitle, traits.aura, traits.armorTier, traits.weaponTier]
      );
    }

    if (stageChanged && oldStage !== newStage) {
      await client.query(
        `INSERT INTO guardian_evolution_history (guardian_id, old_stage, new_stage, old_level, new_level, score_at_transition)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [guardianId, oldStage, newStage, oldLevel, newLevel, newScore]
      );
    }

    await client.query('COMMIT');

    return {
      guardianId,
      oldScore,
      newScore,
      oldLevel,
      newLevel,
      oldStage,
      newStage,
      oldTitle,
      newTitle,
      levelChanged,
      stageChanged,
      titleChanged,
      updatedAt: new Date()
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getEvolutionInternal(guardianId: number, client: any): Promise<GuardianEvolution | null> {
  const result = await client.query<GuardianEvolution>(
    `SELECT * FROM guardian_evolution WHERE guardian_id = $1`,
    [guardianId]
  );
  return result.rows[0] || null;
}
