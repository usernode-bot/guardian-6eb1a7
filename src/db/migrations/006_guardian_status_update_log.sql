-- Guardian Status Update Log and Peer Sync State Schema

-- Append-only log of guardian state changes for realtime propagation
CREATE TABLE IF NOT EXISTS guardian_status_update_log (
  id SERIAL PRIMARY KEY,
  broadcast_id VARCHAR(255) NOT NULL UNIQUE,
  guardian_id INTEGER NOT NULL REFERENCES guardian(id) ON DELETE CASCADE,
  old_stage VARCHAR(20) NOT NULL,
  new_stage VARCHAR(20) NOT NULL,
  old_status VARCHAR(20),
  new_status VARCHAR(20),
  old_score INTEGER NOT NULL,
  new_score INTEGER NOT NULL,
  changed_by_user_id INTEGER,
  changed_by_username VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS guardian_status_update_log_created_idx ON guardian_status_update_log(created_at DESC);
CREATE INDEX IF NOT EXISTS guardian_status_update_log_guardian_idx ON guardian_status_update_log(guardian_id);
CREATE INDEX IF NOT EXISTS guardian_status_update_log_broadcast_idx ON guardian_status_update_log(broadcast_id);

-- Tracks peer synchronization state to prevent duplicate broadcasts
CREATE TABLE IF NOT EXISTS guardian_peer_sync_state (
  id SERIAL PRIMARY KEY,
  guardian_id INTEGER NOT NULL REFERENCES guardian(id) ON DELETE CASCADE,
  peer_user_id INTEGER NOT NULL,
  last_synced_update_id INTEGER REFERENCES guardian_status_update_log(id),
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(guardian_id, peer_user_id)
);

CREATE INDEX IF NOT EXISTS guardian_peer_sync_state_guardian_idx ON guardian_peer_sync_state(guardian_id);
CREATE INDEX IF NOT EXISTS guardian_peer_sync_state_peer_idx ON guardian_peer_sync_state(peer_user_id);
