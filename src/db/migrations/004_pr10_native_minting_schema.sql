-- PR10 Guardian Native Minting Schema

-- Add on-chain minting columns to guardian_ownership
ALTER TABLE IF EXISTS guardian_ownership
ADD COLUMN IF NOT EXISTS onchain_asset_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS onchain_status VARCHAR(20) DEFAULT 'PENDING' CHECK (onchain_status IN ('PENDING', 'CONFIRMED', 'FAILED')),
ADD COLUMN IF NOT EXISTS onchain_registered_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS guardian_ownership_onchain_status_idx ON guardian_ownership(onchain_status);

-- On-chain bridge audit log
CREATE TABLE IF NOT EXISTS guardian_onchain_bridge (
  id SERIAL PRIMARY KEY,
  guardian_id INTEGER NOT NULL REFERENCES guardian(id) ON DELETE CASCADE,
  wallet_address VARCHAR(255) NOT NULL,
  user_id INTEGER NOT NULL,
  username VARCHAR(255) NOT NULL,
  onchain_asset_id VARCHAR(255),
  request_id VARCHAR(255) NOT NULL,
  event VARCHAR(50) NOT NULL CHECK (event IN ('REGISTRATION_INITIATED', 'REGISTRATION_CONFIRMED', 'REGISTRATION_FAILED')),
  metadata JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS guardian_onchain_bridge_guardian_idx ON guardian_onchain_bridge(guardian_id);
CREATE INDEX IF NOT EXISTS guardian_onchain_bridge_event_idx ON guardian_onchain_bridge(event);
CREATE INDEX IF NOT EXISTS guardian_onchain_bridge_wallet_idx ON guardian_onchain_bridge(wallet_address);
