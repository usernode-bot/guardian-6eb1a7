-- P2P Presence & Signaling Schema

CREATE TABLE IF NOT EXISTS user_online_session (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  username VARCHAR(255) NOT NULL,
  wallet_address VARCHAR(255),
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
  session_token VARCHAR(255) NOT NULL UNIQUE,
  guardian_id INTEGER,
  guardian_name VARCHAR(100),
  guardian_tier VARCHAR(20),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_online_session_user_id_idx ON user_online_session(user_id);
CREATE INDEX IF NOT EXISTS user_online_session_username_idx ON user_online_session(username);
CREATE INDEX IF NOT EXISTS user_online_session_heartbeat_idx ON user_online_session(last_heartbeat);
