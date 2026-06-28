-- Guardian Trading & Gifting System Schema

-- Transfer proposal table for gifts and trades
CREATE TABLE IF NOT EXISTS guardian_transfer_proposal (
  id SERIAL PRIMARY KEY,
  guardian_id INTEGER NOT NULL REFERENCES guardian(id) ON DELETE CASCADE,
  sender_user_id INTEGER NOT NULL,
  sender_username VARCHAR(255) NOT NULL,
  sender_wallet VARCHAR(255) NOT NULL,
  recipient_user_id INTEGER,
  recipient_username VARCHAR(255) NOT NULL,
  recipient_wallet VARCHAR(255),
  type VARCHAR(20) NOT NULL CHECK (type IN ('GIFT', 'TRADE')),
  trade_guardian_id INTEGER REFERENCES guardian(id) ON DELETE SET NULL,
  sender_accepted BOOLEAN DEFAULT FALSE,
  recipient_accepted BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'COMPLETED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS guardian_transfer_proposal_status_idx ON guardian_transfer_proposal(status);
CREATE INDEX IF NOT EXISTS guardian_transfer_proposal_expires_idx ON guardian_transfer_proposal(expires_at);
CREATE INDEX IF NOT EXISTS guardian_transfer_proposal_guardian_idx ON guardian_transfer_proposal(guardian_id);
CREATE INDEX IF NOT EXISTS guardian_transfer_proposal_sender_idx ON guardian_transfer_proposal(sender_user_id);
CREATE INDEX IF NOT EXISTS guardian_transfer_proposal_recipient_idx ON guardian_transfer_proposal(recipient_user_id);

-- Transfer history audit log (immutable)
CREATE TABLE IF NOT EXISTS guardian_transfer_history (
  id SERIAL PRIMARY KEY,
  guardian_id INTEGER NOT NULL REFERENCES guardian(id) ON DELETE CASCADE,
  from_wallet VARCHAR(255) NOT NULL,
  to_wallet VARCHAR(255) NOT NULL,
  from_username VARCHAR(255) NOT NULL,
  to_username VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('GIFTED', 'TRADED')),
  proposal_id INTEGER REFERENCES guardian_transfer_proposal(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS guardian_transfer_history_guardian_idx ON guardian_transfer_history(guardian_id);
CREATE INDEX IF NOT EXISTS guardian_transfer_history_wallet_idx ON guardian_transfer_history(from_wallet, to_wallet);
CREATE INDEX IF NOT EXISTS guardian_transfer_history_created_idx ON guardian_transfer_history(created_at DESC);
