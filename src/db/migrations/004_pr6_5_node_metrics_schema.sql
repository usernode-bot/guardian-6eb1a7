-- PR6.5 Real-Time UserNode Testnet Telemetry Integration

-- Guardian node metrics table - stores live RPC polling data
CREATE TABLE IF NOT EXISTS guardian_node_metrics (
  id SERIAL PRIMARY KEY,
  metric_name VARCHAR(50) NOT NULL,
  value TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  source VARCHAR(50) DEFAULT 'usernode-rpc',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS guardian_node_metrics_name_ts_idx
  ON guardian_node_metrics(metric_name, timestamp DESC);
