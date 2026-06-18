-- PR9 Guardian Evolution Engine Schema

-- Guardian evolution state table
CREATE TABLE IF NOT EXISTS guardian_evolution (
  id SERIAL PRIMARY KEY,
  guardian_id INTEGER UNIQUE NOT NULL REFERENCES guardian(id) ON DELETE CASCADE,
  contribution_score INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  stage VARCHAR(20) NOT NULL DEFAULT 'INITIATE' CHECK (stage IN ('INITIATE', 'AWAKENED', 'ASCENDANT', 'GUARDIAN', 'MYTHIC')),
  title VARCHAR(255),
  aura VARCHAR(50),
  armor_tier VARCHAR(50),
  weapon_tier VARCHAR(50),
  rank INTEGER,
  last_score_recalc_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS guardian_evolution_score_idx ON guardian_evolution(contribution_score DESC);
CREATE INDEX IF NOT EXISTS guardian_evolution_stage_idx ON guardian_evolution(stage);
CREATE INDEX IF NOT EXISTS guardian_evolution_rank_idx ON guardian_evolution(rank);

-- Guardian evolution history audit log (immutable)
CREATE TABLE IF NOT EXISTS guardian_evolution_history (
  id SERIAL PRIMARY KEY,
  guardian_id INTEGER NOT NULL REFERENCES guardian(id) ON DELETE CASCADE,
  old_stage VARCHAR(20) NOT NULL,
  new_stage VARCHAR(20) NOT NULL,
  old_level INTEGER NOT NULL,
  new_level INTEGER NOT NULL,
  score_at_transition INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS guardian_evolution_history_guardian_idx ON guardian_evolution_history(guardian_id);
CREATE INDEX IF NOT EXISTS guardian_evolution_history_created_idx ON guardian_evolution_history(created_at DESC);
