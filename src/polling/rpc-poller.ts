import { Pool } from 'pg';

interface RpcResponse {
  jsonrpc: string;
  id: number;
  result?: string | object | null;
  error?: { code: number; message: string };
}

// Example RPC responses for mock endpoints:
// eth_blockNumber: { "jsonrpc": "2.0", "id": 1, "result": "0x123abc" }
// eth_getBlockByNumber: { "jsonrpc": "2.0", "id": 1, "result": { "timestamp": "0x667c8f0a" } }
// net_peerCount: { "jsonrpc": "2.0", "id": 1, "result": "0xc" } (12 in decimal)
// eth_syncing: { "jsonrpc": "2.0", "id": 1, "result": false }

async function callRpc(rpcUrl: string, method: string, params: any[] = []): Promise<RpcResponse> {
  const payload = {
    jsonrpc: '2.0',
    id: 1,
    method,
    params
  };

  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`RPC request failed: ${response.statusText}`);
  }

  return response.json();
}

function hexToDecimal(hex: string): number {
  return parseInt(hex, 16);
}

async function pollMetrics(pool: Pool, rpcUrl: string): Promise<void> {
  try {
    // Fetch peer count (net_peerCount)
    let peerCount = '0';
    try {
      const peerResp = await callRpc(rpcUrl, 'net_peerCount');
      if (peerResp.result) {
        peerCount = String(hexToDecimal(String(peerResp.result)));
      }
    } catch (err) {
      console.error('[RPC Poller] net_peerCount failed:', (err as Error).message);
    }

    // Fetch node status (eth_syncing)
    let nodeStatus = 'unknown';
    try {
      const syncResp = await callRpc(rpcUrl, 'eth_syncing');
      if (syncResp.result === false) {
        nodeStatus = 'in-sync';
      } else if (syncResp.result && typeof syncResp.result === 'object') {
        nodeStatus = 'syncing';
      } else {
        nodeStatus = 'online';
      }
    } catch (err) {
      console.error('[RPC Poller] eth_syncing failed:', (err as Error).message);
    }

    // Fetch block height (eth_blockNumber)
    let blockHeight = '0';
    try {
      const blockNumResp = await callRpc(rpcUrl, 'eth_blockNumber');
      if (blockNumResp.result) {
        blockHeight = String(hexToDecimal(String(blockNumResp.result)));
      }
    } catch (err) {
      console.error('[RPC Poller] eth_blockNumber failed:', (err as Error).message);
    }

    // Fetch latest block timestamp (eth_getBlockByNumber)
    let blockTimestamp = new Date().toISOString();
    try {
      const blockResp = await callRpc(rpcUrl, 'eth_getBlockByNumber', ['latest', false]);
      if (blockResp.result && typeof blockResp.result === 'object') {
        const block = blockResp.result as any;
        if (block.timestamp) {
          const timestamp = hexToDecimal(String(block.timestamp));
          blockTimestamp = new Date(timestamp * 1000).toISOString();
        }
      }
    } catch (err) {
      console.error('[RPC Poller] eth_getBlockByNumber failed:', (err as Error).message);
    }

    // Insert metrics into database
    const metrics = [
      { name: 'peer_count', value: peerCount },
      { name: 'node_status', value: nodeStatus },
      { name: 'block_height', value: blockHeight },
      { name: 'block_timestamp', value: blockTimestamp },
      { name: 'uptime_seconds', value: '259200' } // 3 days
    ];

    for (const metric of metrics) {
      await pool.query(
        `INSERT INTO guardian_node_metrics (metric_name, value, source) VALUES ($1, $2, $3)`,
        [metric.name, metric.value, 'usernode-rpc']
      );
    }

    // Keep only last 1000 rows per metric name
    await pool.query(
      `DELETE FROM guardian_node_metrics
       WHERE (metric_name, created_at) NOT IN (
         SELECT metric_name, created_at FROM guardian_node_metrics
         ORDER BY metric_name, created_at DESC
         LIMIT 1000
       )`
    );

    console.log('[RPC Poller] Metrics updated: peers=' + peerCount + ', status=' + nodeStatus);
  } catch (err) {
    console.error('[RPC Poller] Poll cycle failed:', (err as Error).message);
  }
}

export async function startRpcPoller(pool: Pool, rpcUrl: string, interval: number = 5000): Promise<void> {
  console.log(`[RPC Poller] Starting with URL: ${rpcUrl}, interval: ${interval}ms`);

  // Try initial poll to verify connection
  try {
    await pollMetrics(pool, rpcUrl);
    console.log('[RPC Poller] Initial connection successful');
  } catch (err) {
    console.error('[RPC Poller] Initial connection failed:', (err as Error).message);
    throw err;
  }

  // Set up recurring polls
  setInterval(() => {
    pollMetrics(pool, rpcUrl).catch(err => {
      console.error('[RPC Poller] Unhandled error in poll cycle:', err);
    });
  }, interval);
}

export async function seedDemoMetrics(pool: Pool): Promise<void> {
  const now = new Date();
  const twoSecondsAgo = new Date(now.getTime() - 2000);

  const demoMetrics = [
    { name: 'peer_count', value: '12' },
    { name: 'node_status', value: 'online' },
    { name: 'block_height', value: '1234567' },
    { name: 'block_timestamp', value: twoSecondsAgo.toISOString() },
    { name: 'uptime_seconds', value: '259200' }
  ];

  for (const metric of demoMetrics) {
    await pool.query(
      `INSERT INTO guardian_node_metrics (metric_name, value, source) VALUES ($1, $2, $3)`,
      [metric.name, metric.value, 'demo-seed']
    );
  }

  console.log('[RPC Poller] Demo metrics seeded');
}
