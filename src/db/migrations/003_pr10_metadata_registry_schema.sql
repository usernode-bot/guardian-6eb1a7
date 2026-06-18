-- PR10 Guardian Metadata Registry Schema

CREATE TABLE IF NOT EXISTS guardian_metadata_registry (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE,
  username VARCHAR(255) NOT NULL UNIQUE,
  guardian_id INTEGER NOT NULL UNIQUE REFERENCES guardian(id) ON DELETE CASCADE,
  contribution_score INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  stage VARCHAR(20) NOT NULL DEFAULT 'INITIATE' CHECK (stage IN ('INITIATE', 'AWAKENED', 'ASCENDANT', 'GUARDIAN', 'MYTHIC')),
  fg_hours INTEGER NOT NULL DEFAULT 0,
  peer_count INTEGER NOT NULL DEFAULT 0,
  uptime NUMERIC(5, 2) NOT NULL DEFAULT 0.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS guardian_metadata_registry_username_idx ON guardian_metadata_registry(username);
CREATE INDEX IF NOT EXISTS guardian_metadata_registry_stage_idx ON guardian_metadata_registry(stage);
CREATE INDEX IF NOT EXISTS guardian_metadata_registry_score_idx ON guardian_metadata_registry(contribution_score DESC);
