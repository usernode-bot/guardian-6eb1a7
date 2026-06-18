-- PR8 Guardian Allocation & Reservation Engine Schema

-- Guardian pool table
CREATE TABLE IF NOT EXISTS guardian (
  id INTEGER PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  tier VARCHAR(20) NOT NULL CHECK (tier IN ('COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC')),
  lore TEXT NOT NULL,
  image VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'RESERVED', 'MINTED', 'EXPIRED')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS guardian_status_idx ON guardian(status);

-- Guardian ownership (one wallet owns at most one Guardian; one Guardian belongs to at most one wallet)
CREATE TABLE IF NOT EXISTS guardian_ownership (
  id SERIAL PRIMARY KEY,
  guardian_id INTEGER NOT NULL UNIQUE REFERENCES guardian(id) ON DELETE RESTRICT,
  wallet_address VARCHAR(255) NOT NULL UNIQUE,
  user_id INTEGER NOT NULL,
  username VARCHAR(255) NOT NULL,
  minted_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS guardian_ownership_wallet_idx ON guardian_ownership(wallet_address);

-- Guardian reservation (temporary 1-hour hold)
CREATE TABLE IF NOT EXISTS guardian_reservation (
  id SERIAL PRIMARY KEY,
  guardian_id INTEGER NOT NULL UNIQUE REFERENCES guardian(id) ON DELETE CASCADE,
  wallet_address VARCHAR(255) NOT NULL,
  user_id INTEGER NOT NULL,
  username VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS guardian_reservation_expires_idx ON guardian_reservation(expires_at);
CREATE INDEX IF NOT EXISTS guardian_reservation_wallet_idx ON guardian_reservation(wallet_address);

-- Immutable audit log
CREATE TABLE IF NOT EXISTS guardian_audit_log (
  id SERIAL PRIMARY KEY,
  guardian_id INTEGER NOT NULL REFERENCES guardian(id),
  wallet_address VARCHAR(255) NOT NULL,
  user_id INTEGER NOT NULL,
  username VARCHAR(255) NOT NULL,
  event VARCHAR(20) NOT NULL CHECK (event IN ('ASSIGNED', 'RESERVED', 'MINTED', 'EXPIRED', 'RELEASED')),
  metadata JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS guardian_audit_log_guardian_idx ON guardian_audit_log(guardian_id);
CREATE INDEX IF NOT EXISTS guardian_audit_log_wallet_idx ON guardian_audit_log(wallet_address);
CREATE INDEX IF NOT EXISTS guardian_audit_log_event_idx ON guardian_audit_log(event);
