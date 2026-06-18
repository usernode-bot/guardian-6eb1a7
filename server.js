const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const port = process.env.PORT || 3000;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const JWT_SECRET = process.env.JWT_SECRET;
const IS_STAGING = process.env.USERNODE_ENV === 'staging';

const PUBLIC_API_PATHS = new Set(['/health', '/api/node', '/favicon.ico', '/api/guardians', '/api/evolution/leaderboard', '/api/metadata/registry']);

// WebSocket signaling server state
const wsConnections = new Map(); // user_id -> { socket, sessionToken, username, guardian_id, guardian_name, guardian_tier }
const allClients = new Set(); // all active WebSocket connections
let wss = null;

function generateGuardianPool() {
  const tierCounts = { COMMON: 300, RARE: 120, EPIC: 60, LEGENDARY: 18, MYTHIC: 2 };
  const tierOrder = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC'];
  const names = [
    'Aegis', 'Nyra', 'Orion', 'Zenith', 'Atlas', 'Nova', 'Cipher', 'Vesper', 'Zephyr', 'Iris',
    'Kairos', 'Lyra', 'Malachai', 'Nyx', 'Odin', 'Phoenix', 'Qyra', 'Rax', 'Solaris', 'Thorne',
    'Ulysses', 'Vex', 'Warden', 'Xander', 'Yasmine', 'Zara', 'Aether', 'Bryn', 'Caspian', 'Dryad',
    'Eos', 'Fennix', 'Gareth', 'Halo', 'Ionic', 'Jax', 'Kael', 'Lux', 'Mira', 'Nova',
    'Osiris', 'Prism', 'Quill', 'Rune', 'Sylph', 'Titan', 'Umbra', 'Valkyrie', 'Whisper', 'Xenith', 'Yara'
  ];
  const emojis = { COMMON: '⚔️', RARE: '🗡️', EPIC: '⚡', LEGENDARY: '👑', MYTHIC: '🐉' };
  const loreTitles = {
    COMMON: ['of the Forge', 'of the Valley', 'the Stalwart', 'the Bold', 'the Faithful', 'the Keen'],
    RARE: ['the Sage', 'the Ascendant', 'the Mystic', 'of the Stars', 'the Wise', 'the Eternal'],
    EPIC: ['the Sovereign', 'the Infinite', 'the Arcane', 'the Celestial', 'the Eternal Guardian', 'the Radiant'],
    LEGENDARY: ['the Immortal', 'the Supreme', 'the Transcendent', 'the Void Wielder', 'the Chronicle Keeper'],
    MYTHIC: ['the Primordial', 'the Cosmic Architect']
  };
  const loreSnippets = {
    COMMON: ['A steadfast protector of the network nodes.', 'A reliable sentinel guarding the ledgers.', 'A devoted keeper of the transaction flow.', 'A tireless warden of the blockchain peace.', 'A noble guardian of distributed harmony.', 'A stalwart defender of peer consensus.'],
    RARE: ['An ancient guardian blessed with cryptographic sight.', 'A master of the consensus algorithm.', 'A keeper of the sacred verification rituals.', 'A guardian who commands respect across all nodes.', 'An oracle of the distributed ledger.', 'A sage who balances all network forces.'],
    EPIC: ['A legendary guardian forged in the dawn of cryptography.', 'A wielder of infinite computational power.', 'A sentinel born from the stars of the blockchain realm.', 'An eternal keeper of the most ancient protocols.', 'A guardian whose presence stabilizes entire networks.', 'A cosmic force of immutable truth and justice.'],
    LEGENDARY: ['An immortal being transcending all network boundaries.', 'The supreme guardian of all peer-to-peer realms.', 'A transcendent force dwelling beyond mortal computation.', 'The void wielder commanding the darkest cryptography.', 'The keeper of all network chronicles and histories.'],
    MYTHIC: ['The primordial force from which all networks were born.', 'The cosmic architect who designed the ledger itself.']
  };

  const guardians = [];
  let index = 0;
  for (const tier of tierOrder) {
    for (let i = 0; i < tierCounts[tier]; i++) {
      const nameIndex = index % names.length;
      const cycle = Math.floor(index / names.length);
      const name = cycle === 0 ? names[nameIndex] : `${names[nameIndex]} ${cycle}`;
      const title = `Guardian ${loreTitles[tier][index % loreTitles[tier].length]}`;
      const lore = loreSnippets[tier][index % loreSnippets[tier].length];

      guardians.push({
        id: index + 1,
        name,
        title,
        tier,
        lore,
        image: emojis[tier],
      });
      index++;
    }
  }

  return guardians;
}

app.use(express.json());

app.use((req, res, next) => {
  const token = req.query.token || req.headers['x-usernode-token'];
  if (token && JWT_SECRET) {
    try { req.user = jwt.verify(token, JWT_SECRET); } catch {}
  }

  if (req.method !== 'GET' || req.path.startsWith('/api/')) {
    if (PUBLIC_API_PATHS.has(req.path)) return next();
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.get('/api/guardian', async (req, res) => {
  try {
    res.json({
      guardian_name: 'Guardian',
      mood: 'neutral',
      health: 80,
      energy: 60,
      level: 1,
      xp: 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/guardian', async (req, res) => {
  try {
    res.json({
      guardian_name: 'Guardian',
      mood: 'neutral',
      health: 80,
      energy: 60,
      level: 1,
      xp: 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/node', async (req, res) => {
  try {
    let metrics = {};

    try {
      // Fetch latest metrics from guardian_node_metrics table
      const result = await pool.query(
        `SELECT DISTINCT ON (metric_name) metric_name, value
         FROM guardian_node_metrics
         ORDER BY metric_name, created_at DESC`
      );

      for (const row of result.rows) {
        metrics[row.metric_name] = row.value;
      }
    } catch (queryErr) {
      // Table might not exist yet (e.g., during startup before migrations complete)
      // Fall through to fallback values below
      console.log('[/api/node] Metrics table not available, using fallback values');
    }

    // If no metrics in staging, try to seed demo metrics immediately
    if (IS_STAGING && Object.keys(metrics).length === 0) {
      try {
        const { seedDemoMetrics } = require('./src/polling/rpc-poller');
        await seedDemoMetrics(pool);
        // Re-fetch after seeding
        const refreshed = await pool.query(
          `SELECT DISTINCT ON (metric_name) metric_name, value
           FROM guardian_node_metrics
           ORDER BY metric_name, created_at DESC`
        );
        metrics = {};
        for (const row of refreshed.rows) {
          metrics[row.metric_name] = row.value;
        }
      } catch (seedErr) {
        // RPC poller module not available or seeding failed
        // Use fallback values instead
        console.log('[/api/node] Demo metrics seeding unavailable, using fallback values:', seedErr.message);
      }
    }

    res.json({
      status: metrics.node_status || 'running',
      uptimeSeconds: parseInt(metrics.uptime_seconds || '259200'),
      peers: parseInt(metrics.peer_count || '12'),
      blockHeight: parseInt(metrics.block_height || '1234567'),
      lastBlockTime: metrics.block_timestamp || '2 min ago'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/wallet', async (req, res) => {
  const logPrefix = '[wallet-api]';
  try {
    console.log(`${logPrefix} Processing wallet balance request`);

    // Step 1: Extract usernode_pubkey from JWT token
    const usernodeAddress = req.user ? (req.user.usernode_pubkey || null) : null;
    console.log(`${logPrefix} Step 1 - Extract usernode_pubkey: ${usernodeAddress ? 'success' : 'no address'}`);

    if (usernodeAddress) {
      console.log(`${logPrefix}   Usernode address: ${usernodeAddress.substring(0, 8)}...${usernodeAddress.substring(usernodeAddress.length - 6)}`);
    }

    if (!usernodeAddress) {
      console.log(`${logPrefix} No usernode address found, returning null balance`);
      return res.json({
        address: null,
        balance: null
      });
    }

    // Step 2: Check if NODE_RPC_URL is configured (platform-provided)
    console.log(`${logPrefix} Step 2 - Check NODE_RPC_URL environment variable`);
    const rpcUrl = process.env.NODE_RPC_URL;

    if (!rpcUrl) {
      console.log(`${logPrefix}   WARNING: NODE_RPC_URL not configured, cannot fetch balance`);
      return res.json({
        address: usernodeAddress,
        balance: null
      });
    }

    console.log(`${logPrefix}   RPC URL configured: ${rpcUrl.substring(0, 30)}...`);

    // Step 3: Make JSON-RPC call to fetch UT balance from Usernode network
    console.log(`${logPrefix} Step 3 - Fetching UT balance from Usernode RPC`);
    console.log(`${logPrefix}   Calling eth_getBalance for address: ${usernodeAddress}`);

    try {
      const rpcResponse = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getBalance',
          params: [usernodeAddress, 'latest'],
          id: 1
        })
      });

      console.log(`${logPrefix}   RPC HTTP response: ${rpcResponse.status} ${rpcResponse.statusText}`);

      if (!rpcResponse.ok) {
        console.error(`${logPrefix}   ERROR: RPC endpoint returned HTTP ${rpcResponse.status}`);
        const responseText = await rpcResponse.text();
        console.error(`${logPrefix}   Response body: ${responseText.substring(0, 200)}`);
        return res.json({
          address: usernodeAddress,
          balance: null
        });
      }

      // Step 4: Parse balance from RPC response
      console.log(`${logPrefix} Step 4 - Parsing balance from RPC response`);
      let rpcData;

      try {
        rpcData = await rpcResponse.json();
        console.log(`${logPrefix}   Successfully parsed RPC response`);
      } catch (parseErr) {
        console.error(`${logPrefix}   ERROR: Failed to parse RPC response as JSON: ${parseErr.message}`);
        return res.json({
          address: usernodeAddress,
          balance: null
        });
      }

      if (rpcData.error) {
        console.error(`${logPrefix}   ERROR: RPC returned error response`);
        console.error(`${logPrefix}   RPC error code: ${rpcData.error.code || 'unknown'}`);
        console.error(`${logPrefix}   RPC error message: ${rpcData.error.message}`);
        return res.json({
          address: usernodeAddress,
          balance: null
        });
      }

      if (!rpcData.result) {
        console.error(`${logPrefix}   ERROR: RPC response missing 'result' field`);
        console.log(`${logPrefix}   RPC response keys: ${Object.keys(rpcData).join(', ')}`);
        return res.json({
          address: usernodeAddress,
          balance: null
        });
      }

      console.log(`${logPrefix}   Balance result from RPC: ${rpcData.result}`);

      // Convert balance from wei to UT
      let balanceWei, balanceUt, formattedBalance;

      try {
        balanceWei = BigInt(rpcData.result);
        console.log(`${logPrefix}   Parsed balance in wei: ${balanceWei.toString()}`);

        balanceUt = Number(balanceWei) / 1e18;
        console.log(`${logPrefix}   Converted to UT: ${balanceUt}`);

        formattedBalance = balanceUt.toFixed(4).replace(/\.?0+$/, '') || '0';
        console.log(`${logPrefix}   Formatted balance: ${formattedBalance} UT`);
      } catch (conversionErr) {
        console.error(`${logPrefix}   ERROR: Failed to convert balance from wei to UT: ${conversionErr.message}`);
        return res.json({
          address: usernodeAddress,
          balance: null
        });
      }

      console.log(`${logPrefix} SUCCESS: Returning balance ${formattedBalance} UT`);
      res.json({
        address: usernodeAddress,
        balance: `${formattedBalance} UT`
      });
    } catch (rpcErr) {
      console.error(`${logPrefix} Step 3 ERROR: Network or RPC call error: ${rpcErr.message}`);
      console.error(`${logPrefix}   Error stack: ${rpcErr.stack}`);
      res.json({
        address: usernodeAddress,
        balance: null
      });
    }
  } catch (err) {
    console.error(`${logPrefix} CRITICAL ERROR in wallet endpoint: ${err.message}`);
    console.error(`${logPrefix}   Error stack: ${err.stack}`);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/guardians', (req, res) => {
  try {
    if (!IS_STAGING) {
      return res.status(403).json({ error: 'Guardian gallery unavailable' });
    }
    const guardianPool = generateGuardianPool();
    res.json({
      guardians: guardianPool,
      total: guardianPool.length,
      allocated: 0,
      unallocated: guardianPool.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/guardian/assign', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const wallet = req.user.usernode_pubkey;
    if (!wallet) {
      return res.status(400).json({ error: 'Wallet not linked' });
    }

    const result = await pool.query(
      `SELECT gr.*, g.id, g.name, g.tier, g.lore, g.image, g.status FROM guardian_reservation gr
       JOIN guardian g ON gr.guardian_id = g.id
       WHERE gr.wallet_address = $1 AND gr.expires_at > NOW()
       LIMIT 1`,
      [wallet]
    );

    if (result.rows.length > 0) {
      const reservation = result.rows[0];
      const expiresAt = new Date(reservation.expires_at);
      const expiresIn = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));

      return res.json({
        success: true,
        guardian: {
          id: reservation.id,
          name: reservation.name,
          tier: reservation.tier,
          lore: reservation.lore,
          image: reservation.image
        },
        reservation: {
          expiresAt: expiresAt.toISOString(),
          expiresIn
        }
      });
    }

    await pool.query(`DELETE FROM guardian_reservation WHERE wallet_address = $1 AND expires_at <= NOW()`, [wallet]);

    const available = await pool.query(
      `SELECT * FROM guardian WHERE status = 'AVAILABLE' ORDER BY RANDOM() LIMIT 1`
    );

    if (available.rows.length === 0) {
      return res.status(500).json({ error: 'No available Guardians' });
    }

    const guardian = available.rows[0];
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(`UPDATE guardian SET status = 'RESERVED' WHERE id = $1`, [guardian.id]);

      const reservationResult = await client.query(
        `INSERT INTO guardian_reservation (guardian_id, wallet_address, user_id, username, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [guardian.id, wallet, req.user.id, req.user.username, expiresAt]
      );

      const reservation = reservationResult.rows[0];

      await client.query(
        `INSERT INTO guardian_audit_log (guardian_id, wallet_address, user_id, username, event, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [guardian.id, wallet, req.user.id, req.user.username, 'ASSIGNED', JSON.stringify({ tier: guardian.tier, name: guardian.name })]
      );

      await client.query(
        `INSERT INTO guardian_audit_log (guardian_id, wallet_address, user_id, username, event, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [guardian.id, wallet, req.user.id, req.user.username, 'RESERVED', JSON.stringify({ expiresAt: expiresAt.toISOString() })]
      );

      await client.query('COMMIT');

      const expiresIn = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));

      return res.json({
        success: true,
        guardian: {
          id: guardian.id,
          name: guardian.name,
          tier: guardian.tier,
          lore: guardian.lore,
          image: guardian.image
        },
        reservation: {
          expiresAt: expiresAt.toISOString(),
          expiresIn
        }
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/guardian/current', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const wallet = req.user.usernode_pubkey;
    if (!wallet) {
      return res.json({
        guardian: null,
        status: null,
        reservation: null,
        ownership: null
      });
    }

    await pool.query(
      `DELETE FROM guardian_reservation WHERE wallet_address = $1 AND expires_at <= NOW()`,
      [wallet]
    );

    const guardianResult = await pool.query(
      `SELECT g.*,
              CASE
                WHEN gr.id IS NOT NULL AND gr.expires_at > NOW() THEN 'RESERVED'
                WHEN go.minted_at IS NOT NULL THEN 'MINTED'
                ELSE NULL
              END as current_status,
              gr.id as reservation_id,
              gr.expires_at as reservation_expires,
              go.id as ownership_id,
              go.minted_at as minted_at
       FROM guardian g
       LEFT JOIN guardian_reservation gr ON g.id = gr.guardian_id AND gr.wallet_address = $1
       LEFT JOIN guardian_ownership go ON g.id = go.guardian_id AND go.wallet_address = $1
       WHERE gr.id IS NOT NULL OR go.id IS NOT NULL
       LIMIT 1`,
      [wallet]
    );

    if (guardianResult.rows.length === 0) {
      return res.json({
        guardian: null,
        status: null,
        reservation: null,
        ownership: null
      });
    }

    const row = guardianResult.rows[0];
    const guardian = {
      id: row.id,
      name: row.name,
      title: row.title,
      tier: row.tier,
      lore: row.lore,
      image: row.image,
      status: row.status
    };

    const status = row.current_status;
    const reservation = row.reservation_id ? {
      expiresAt: new Date(row.reservation_expires).toISOString(),
      expiresIn: Math.max(0, Math.floor((new Date(row.reservation_expires).getTime() - Date.now()) / 1000))
    } : null;

    const ownership = row.ownership_id ? {
      guardian_id: row.id,
      wallet_address: wallet,
      user_id: req.user.id,
      username: req.user.username,
      minted_at: row.minted_at
    } : null;

    res.json({
      guardian,
      status,
      reservation,
      ownership
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/supply/stats', async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM guardian_reservation WHERE expires_at <= NOW()`
    );

    const result = await pool.query(
      `SELECT tier, status, COUNT(*) as count FROM guardian GROUP BY tier, status`
    );

    const tiers = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC'];
    const byTier = {
      COMMON: { available: 0, reserved: 0, minted: 0 },
      RARE: { available: 0, reserved: 0, minted: 0 },
      EPIC: { available: 0, reserved: 0, minted: 0 },
      LEGENDARY: { available: 0, reserved: 0, minted: 0 },
      MYTHIC: { available: 0, reserved: 0, minted: 0 }
    };

    let total = 0;
    let available = 0;
    let reserved = 0;
    let minted = 0;

    for (const row of result.rows) {
      const count = parseInt(row.count);
      total += count;

      if (row.status === 'AVAILABLE') {
        available += count;
        byTier[row.tier].available += count;
      } else if (row.status === 'RESERVED') {
        reserved += count;
        byTier[row.tier].reserved += count;
      } else if (row.status === 'MINTED') {
        minted += count;
        byTier[row.tier].minted += count;
      }
    }

    res.json({
      total,
      available,
      reserved,
      minted,
      byTier
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/guardian/mint', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const wallet = req.user.usernode_pubkey;
    if (!wallet) {
      return res.status(400).json({ error: 'Wallet not linked' });
    }

    const reservation = await pool.query(
      `SELECT gr.*, g.name, g.tier FROM guardian_reservation gr
       JOIN guardian g ON gr.guardian_id = g.id
       WHERE gr.wallet_address = $1 AND gr.expires_at > NOW()
       LIMIT 1`,
      [wallet]
    );

    if (reservation.rows.length === 0) {
      return res.status(404).json({ error: 'No active reservation found' });
    }

    const res_row = reservation.rows[0];
    const guardianId = res_row.guardian_id;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE guardian SET status = 'MINTED' WHERE id = $1`,
        [guardianId]
      );

      const ownershipResult = await client.query(
        `INSERT INTO guardian_ownership (guardian_id, wallet_address, user_id, username, minted_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (guardian_id) DO UPDATE SET updated_at = NOW() RETURNING *`,
        [guardianId, wallet, req.user.id, req.user.username]
      );

      const ownership = ownershipResult.rows[0];

      await client.query(
        `DELETE FROM guardian_reservation WHERE guardian_id = $1`,
        [guardianId]
      );

      await client.query(
        `INSERT INTO guardian_audit_log (guardian_id, wallet_address, user_id, username, event, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [guardianId, wallet, req.user.id, req.user.username, 'MINTED', JSON.stringify({ guardianName: res_row.name, guardianTier: res_row.tier })]
      );

      const registryResult = await client.query(
        `INSERT INTO guardian_metadata_registry (user_id, username, guardian_id, contribution_score, level, stage, fg_hours, peer_count, uptime)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (user_id) DO UPDATE SET guardian_id = $3 RETURNING *`,
        [req.user.id, req.user.username, guardianId, 0, 1, 'INITIATE', 0, 0, 0.0]
      );

      const registry = registryResult.rows[0];

      await client.query('COMMIT');

      res.json({
        success: true,
        ownership: {
          guardianId: ownership.guardian_id,
          walletAddress: ownership.wallet_address,
          userId: ownership.user_id,
          username: ownership.username,
          mintedAt: ownership.minted_at
        },
        registry: {
          userId: registry.user_id,
          username: registry.username,
          guardianId: registry.guardian_id,
          contributionScore: registry.contribution_score,
          level: registry.level,
          stage: registry.stage,
          fgHours: registry.fg_hours,
          peerCount: registry.peer_count,
          uptime: registry.uptime
        }
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/guardian/history', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const wallet = req.user.usernode_pubkey;
    if (!wallet) {
      return res.json({ events: [] });
    }

    const result = await pool.query(
      `SELECT gal.*, g.name, g.id as guardian_id FROM guardian_audit_log gal
       LEFT JOIN guardian g ON gal.guardian_id = g.id
       WHERE gal.wallet_address = $1
       ORDER BY gal.created_at DESC`,
      [wallet]
    );

    const events = result.rows.map(row => ({
      event: row.event,
      guardian: row.guardian_id ? { id: row.guardian_id, name: row.name } : null,
      createdAt: row.created_at,
      metadata: row.metadata
    }));

    res.json({ events });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/guardian/cleanup', async (req, res) => {
  try {
    if (!req.user || !req.user.admin) {
      return res.status(403).json({ error: 'Admin only' });
    }

    const result = await pool.query(
      `DELETE FROM guardian_reservation WHERE expires_at <= NOW() RETURNING *`
    );

    for (const reservation of result.rows) {
      await pool.query(
        `UPDATE guardian SET status = 'AVAILABLE' WHERE id = $1`,
        [reservation.guardian_id]
      );

      await pool.query(
        `INSERT INTO guardian_audit_log (guardian_id, wallet_address, user_id, username, event, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [reservation.guardian_id, reservation.wallet_address, reservation.user_id, reservation.username, 'EXPIRED', JSON.stringify({ expiresAt: reservation.expires_at })]
      );

      await pool.query(
        `INSERT INTO guardian_audit_log (guardian_id, wallet_address, user_id, username, event, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [reservation.guardian_id, reservation.wallet_address, reservation.user_id, reservation.username, 'RELEASED', JSON.stringify({ reason: 'reservation_expired' })]
      );
    }

    res.json({ released: result.rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Evolution Engine API endpoints
app.post('/api/evolution/update', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const wallet = req.user.usernode_pubkey;
    if (!wallet) {
      return res.status(400).json({ error: 'Wallet not linked' });
    }

    const { fgHours, peerCount, uptime } = req.body;

    if (typeof fgHours !== 'number' || typeof peerCount !== 'number' || typeof uptime !== 'number') {
      return res.status(400).json({ error: 'Invalid metrics' });
    }

    const ownership = await pool.query(
      `SELECT guardian_id FROM guardian_ownership WHERE wallet_address = $1`,
      [wallet]
    );

    if (ownership.rows.length === 0) {
      return res.status(404).json({ error: 'No guardian assigned to wallet' });
    }

    const guardianId = ownership.rows[0].guardian_id;

    const { calculateContributionScore } = require('./src/evolution/score.service');
    const { checkLevelProgression } = require('./src/evolution/level.service');
    const { checkStageProgression, calculateStage } = require('./src/evolution/stages.service');
    const { calculateTitle } = require('./src/evolution/title.service');
    const { getTraitsForStage } = require('./src/evolution/traits.service');

    const currentResult = await pool.query(
      `SELECT * FROM guardian_evolution WHERE guardian_id = $1`,
      [guardianId]
    );

    const current = currentResult.rows[0];
    const oldScore = current?.contribution_score || 0;
    const oldLevel = current?.level || 1;
    const oldStage = current?.stage || 'INITIATE';
    const oldTitle = current?.title || '';

    const newScore = calculateContributionScore({ fgHours, peerCount, uptime });
    const { levelChanged, newLevel } = checkLevelProgression(oldScore, newScore);
    const { stageChanged, newStage } = checkStageProgression(oldScore, newScore);
    const newTitle = calculateTitle(newScore);
    const titleChanged = oldTitle !== newTitle;

    const traits = getTraitsForStage(newStage);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (!current) {
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

      const ownershipCheck = await client.query(
        `SELECT user_id, username FROM guardian_ownership WHERE guardian_id = $1`,
        [guardianId]
      );

      if (ownershipCheck.rows.length > 0) {
        const owner = ownershipCheck.rows[0];
        await client.query(
          `INSERT INTO guardian_metadata_registry (user_id, username, guardian_id, contribution_score, level, stage, fg_hours, peer_count, uptime)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (user_id) DO UPDATE SET
             contribution_score = $4,
             level = $5,
             stage = $6,
             fg_hours = $7,
             peer_count = $8,
             uptime = $9,
             updated_at = NOW()`,
          [owner.user_id, owner.username, guardianId, newScore, newLevel, newStage, fgHours, peerCount, uptime]
        );
      }

      await client.query('COMMIT');

      res.json({
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
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/evolution/guardian/:guardianId', async (req, res) => {
  try {
    const { guardianId } = req.params;
    const result = await pool.query(
      `SELECT * FROM guardian_evolution WHERE guardian_id = $1`,
      [parseInt(guardianId)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Evolution record not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/evolution/leaderboard', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;

    const entries = await pool.query(
      `SELECT
        ROW_NUMBER() OVER (ORDER BY ge.contribution_score DESC) as rank,
        ge.guardian_id,
        g.name,
        g.tier,
        ge.stage,
        ge.contribution_score,
        ge.level,
        ge.title,
        go.username,
        go.wallet_address
      FROM guardian_evolution ge
      JOIN guardian g ON ge.guardian_id = g.id
      LEFT JOIN guardian_ownership go ON ge.guardian_id = go.guardian_id
      ORDER BY ge.contribution_score DESC
      LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const totalResult = await pool.query(`SELECT COUNT(*) as count FROM guardian_evolution`);
    const total = totalResult.rows[0]?.count || 0;

    res.json({
      entries: entries.rows.map(row => ({
        rank: row.rank,
        guardianId: row.guardian_id,
        guardianName: row.name,
        guardianTier: row.tier,
        stage: row.stage,
        contributionScore: row.contribution_score,
        level: row.level,
        title: row.title,
        username: row.username || 'Unknown',
        walletAddress: row.wallet_address || 'Not linked'
      })),
      total,
      limit,
      offset
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/evolution/history/:guardianId', async (req, res) => {
  try {
    const { guardianId } = req.params;
    const result = await pool.query(
      `SELECT * FROM guardian_evolution_history WHERE guardian_id = $1 ORDER BY created_at DESC`,
      [parseInt(guardianId)]
    );

    res.json({ history: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Guardian Metadata Registry API endpoints
app.post('/api/metadata/registry', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { guardianId, owner, score, level, stage, fgHours, peerCount, uptime } = req.body;

    if (owner !== req.user.username) {
      return res.status(400).json({ error: 'Owner must match authenticated user' });
    }

    if (typeof level !== 'number' || typeof fgHours !== 'number' || typeof peerCount !== 'number' || typeof uptime !== 'number') {
      return res.status(400).json({ error: 'Invalid numeric fields' });
    }

    if (level < 0 || fgHours < 0 || peerCount < 0 || uptime < 0) {
      return res.status(400).json({ error: 'Numeric fields must be non-negative' });
    }

    const validStages = ['INITIATE', 'AWAKENED', 'ASCENDANT', 'MYTHIC'];
    if (!validStages.includes(stage)) {
      return res.status(400).json({ error: 'Invalid stage value' });
    }

    const ownership = await pool.query(
      `SELECT guardian_id FROM guardian_ownership WHERE guardian_id = $1 AND user_id = $2`,
      [guardianId, req.user.id]
    );

    if (ownership.rows.length === 0) {
      return res.status(404).json({ error: 'Guardian not found for this user' });
    }

    const result = await pool.query(
      `INSERT INTO guardian_metadata_registry (user_id, username, guardian_id, contribution_score, level, stage, fg_hours, peer_count, uptime, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         contribution_score = $4,
         level = $5,
         stage = $6,
         fg_hours = $7,
         peer_count = $8,
         uptime = $9,
         updated_at = NOW()
       RETURNING *`,
      [req.user.id, req.user.username, guardianId, score, level, stage, fgHours, peerCount, uptime]
    );

    const registry = result.rows[0];
    res.json({
      success: true,
      registry: {
        userId: registry.user_id,
        username: registry.username,
        guardianId: registry.guardian_id,
        contributionScore: registry.contribution_score,
        level: registry.level,
        stage: registry.stage,
        fgHours: registry.fg_hours,
        peerCount: registry.peer_count,
        uptime: registry.uptime,
        updatedAt: registry.updated_at
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/metadata/registry', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;
    const search = req.query.search ? `%${req.query.search.toLowerCase()}%` : null;
    const stageFilter = req.query.stage || null;

    let whereClause = '';
    const params = [];

    if (search) {
      whereClause += `(LOWER(gmr.username) LIKE $${params.length + 1} OR LOWER(g.name) LIKE $${params.length + 1})`;
      params.push(search);
    }

    if (stageFilter) {
      if (whereClause) whereClause += ' AND ';
      whereClause += `gmr.stage = $${params.length + 1}`;
      params.push(stageFilter);
    }

    const whereSQL = whereClause ? `WHERE ${whereClause}` : '';

    const entries = await pool.query(
      `SELECT
        ROW_NUMBER() OVER (ORDER BY gmr.contribution_score DESC) as rank,
        gmr.user_id,
        gmr.username,
        gmr.guardian_id,
        g.name as guardian_name,
        g.tier as guardian_tier,
        g.image as guardian_image,
        gmr.contribution_score,
        gmr.level,
        gmr.stage,
        gmr.fg_hours,
        gmr.peer_count,
        gmr.uptime,
        gmr.updated_at
      FROM guardian_metadata_registry gmr
      JOIN guardian g ON gmr.guardian_id = g.id
      ${whereSQL}
      ORDER BY gmr.contribution_score DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const totalResult = await pool.query(
      `SELECT COUNT(*) as count FROM guardian_metadata_registry gmr
       JOIN guardian g ON gmr.guardian_id = g.id
       ${whereSQL}`,
      params
    );

    const total = parseInt(totalResult.rows[0]?.count || 0);

    res.json({
      entries: entries.rows.map(row => ({
        rank: row.rank,
        userId: row.user_id,
        username: row.username,
        guardianId: row.guardian_id,
        guardianName: row.guardian_name,
        guardianTier: row.guardian_tier,
        guardianImage: row.guardian_image,
        contributionScore: row.contribution_score,
        level: row.level,
        stage: row.stage,
        fgHours: row.fg_hours,
        peerCount: row.peer_count,
        uptime: row.uptime,
        updatedAt: row.updated_at
      })),
      total,
      limit,
      offset
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/metadata/registry/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const result = await pool.query(
      `SELECT
        gmr.user_id,
        gmr.username,
        gmr.guardian_id,
        g.name as guardian_name,
        g.tier as guardian_tier,
        g.image as guardian_image,
        gmr.contribution_score,
        gmr.level,
        gmr.stage,
        gmr.fg_hours,
        gmr.peer_count,
        gmr.uptime,
        gmr.updated_at
      FROM guardian_metadata_registry gmr
      JOIN guardian g ON gmr.guardian_id = g.id
      WHERE LOWER(gmr.username) = LOWER($1)`,
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found in registry' });
    }

    const row = result.rows[0];
    res.json({
      userId: row.user_id,
      username: row.username,
      guardianId: row.guardian_id,
      guardianName: row.guardian_name,
      guardianTier: row.guardian_tier,
      guardianImage: row.guardian_image,
      contributionScore: row.contribution_score,
      level: row.level,
      stage: row.stage,
      fgHours: row.fg_hours,
      peerCount: row.peer_count,
      uptime: row.uptime,
      updatedAt: row.updated_at
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// P2P Signaling API
app.post('/api/signaling/offer', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { to_user_id, offer } = req.body;
    if (!to_user_id || !offer) {
      return res.status(400).json({ error: 'Missing to_user_id or offer' });
    }

    const targetConn = wsConnections.get(to_user_id);
    if (!targetConn) {
      return res.status(404).json({ error: 'Target user not online' });
    }

    targetConn.socket.send(JSON.stringify({
      type: 'peer_offer',
      from_user_id: req.user.id,
      from_username: req.user.username,
      offer
    }));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/signaling/answer', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { to_user_id, answer } = req.body;
    if (!to_user_id || !answer) {
      return res.status(400).json({ error: 'Missing to_user_id or answer' });
    }

    const targetConn = wsConnections.get(to_user_id);
    if (!targetConn) {
      return res.status(404).json({ error: 'Target user not online' });
    }

    targetConn.socket.send(JSON.stringify({
      type: 'peer_answer',
      from_user_id: req.user.id,
      from_username: req.user.username,
      answer
    }));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/signaling/ice-candidate', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { to_user_id, candidate } = req.body;
    if (!to_user_id || !candidate) {
      return res.status(400).json({ error: 'Missing to_user_id or candidate' });
    }

    const targetConn = wsConnections.get(to_user_id);
    if (!targetConn) {
      return res.status(404).json({ error: 'Target user not online' });
    }

    targetConn.socket.send(JSON.stringify({
      type: 'ice_candidate',
      from_user_id: req.user.id,
      candidate
    }));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/registry', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'registry.html'));
});

app.get('/registry/my-metadata', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'metadata-edit.html'));
});

app.use(express.static(path.join(__dirname, 'public')));
app.get('/favicon.ico', (req, res) => res.sendFile(path.join(__dirname, 'public', 'favicon.ico')));

app.get('*', (req, res) => {
  if (!req.user) {
    return res.status(401).send(`<!doctype html><meta charset=utf-8><title>Open in Usernode</title>
<body style="font-family:system-ui;background:#09090b;color:#e4e4e7;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
  <div style="max-width:24rem;padding:2rem;text-align:center">
    <h1 style="font-size:1.25rem;margin:0 0 0.5rem">Open this app inside Usernode</h1>
    <p style="color:#a1a1aa;font-size:0.9rem;margin:0 0 1.25rem">This page is served via the platform; direct visits aren't authenticated.</p>
    <a href="https://social-vibecoding.usernodelabs.org" style="display:inline-block;padding:0.5rem 1rem;background:#7c3aed;color:white;border-radius:0.5rem;text-decoration:none;font-size:0.9rem">Go to Usernode</a>
  </div>
</body>`);
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function applyMigrations() {
  const migrationPath1 = path.join(__dirname, 'src', 'db', 'migrations', '001_pr8_schema.sql');
  const migrationSql1 = fs.readFileSync(migrationPath1, 'utf-8');
  await pool.query(migrationSql1);

  const migrationPath2 = path.join(__dirname, 'src', 'db', 'migrations', '002_pr9_evolution_schema.sql');
  const migrationSql2 = fs.readFileSync(migrationPath2, 'utf-8');
  await pool.query(migrationSql2);

  const migrationPath3 = path.join(__dirname, 'src', 'db', 'migrations', '003_pr10_metadata_registry_schema.sql');
  const migrationSql3 = fs.readFileSync(migrationPath3, 'utf-8');
  await pool.query(migrationSql3);

  const migrationPath4 = path.join(__dirname, 'src', 'db', 'migrations', '004_p2p_presence_schema.sql');
  const migrationSql4 = fs.readFileSync(migrationPath4, 'utf-8');
  await pool.query(migrationSql4);

  const migrationPath5 = path.join(__dirname, 'src', 'db', 'migrations', '005_drop_presence_schema.sql');
  const migrationSql5 = fs.readFileSync(migrationPath5, 'utf-8');
  await pool.query(migrationSql5);
}


async function seedStagingData() {
  if (!IS_STAGING) return;

  const guardians = generateGuardianPool();

  for (const guardian of guardians) {
    await pool.query(
      `INSERT INTO guardian (id, name, title, tier, lore, image, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO NOTHING`,
      [guardian.id, guardian.name, guardian.title, guardian.tier, guardian.lore, guardian.image, 'AVAILABLE']
    );
  }

  const reservationTime = new Date(Date.now() + 30 * 60 * 1000);
  await pool.query(
    `INSERT INTO guardian_reservation (guardian_id, wallet_address, user_id, username, expires_at)
     VALUES (2, 'staging-demo-wallet-1', -1, 'staging-demo-user-1', $1)
     ON CONFLICT (guardian_id) DO NOTHING`,
    [reservationTime]
  );

  await pool.query(
    `UPDATE guardian SET status = 'RESERVED' WHERE id = 2 AND status = 'AVAILABLE'`
  );

  // Seed evolution data for testing
  const stagingDemoScores = [
    { guardianId: 1, score: 50, stage: 'INITIATE', level: 1, title: 'Node Wanderer' },
    { guardianId: 3, score: 150, stage: 'AWAKENED', level: 2, title: 'Network Scout' },
    { guardianId: 4, score: 350, stage: 'ASCENDANT', level: 3, title: 'Protocol Guardian' },
    { guardianId: 6, score: 1500, stage: 'MYTHIC', level: 5, title: 'Legend Keeper' }
  ];

  const traitsByStage = {
    INITIATE: { aura: 'Gray Aura', armor_tier: 'Novice Leather', weapon_tier: 'Wooden Staff' },
    AWAKENED: { aura: 'Blue Aura', armor_tier: 'Apprentice Chain', weapon_tier: 'Iron Sword' },
    ASCENDANT: { aura: 'Gold Aura', armor_tier: 'Knight Plate', weapon_tier: 'Enchanted Blade' },
    MYTHIC: { aura: 'Celestial Aura', armor_tier: 'Legendary Divinity Plate', weapon_tier: 'Cosmic Spear' }
  };

  for (const demo of stagingDemoScores) {
    const traits = traitsByStage[demo.stage];
    await pool.query(
      `INSERT INTO guardian_evolution (guardian_id, contribution_score, level, stage, title, aura, armor_tier, weapon_tier, last_score_recalc_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (guardian_id) DO NOTHING`,
      [demo.guardianId, demo.score, demo.level, demo.stage, demo.title, traits.aura, traits.armor_tier, traits.weapon_tier]
    );
  }

  // Seed evolution history for first few guardians
  const historyEntries = [
    { guardianId: 3, oldStage: 'INITIATE', newStage: 'AWAKENED', oldLevel: 1, newLevel: 2, score: 150 },
    { guardianId: 4, oldStage: 'INITIATE', newStage: 'AWAKENED', oldLevel: 1, newLevel: 2, score: 150 },
    { guardianId: 4, oldStage: 'AWAKENED', newStage: 'ASCENDANT', oldLevel: 2, newLevel: 3, score: 350 }
  ];

  for (const entry of historyEntries) {
    await pool.query(
      `INSERT INTO guardian_evolution_history (guardian_id, old_stage, new_stage, old_level, new_level, score_at_transition)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [entry.guardianId, entry.oldStage, entry.newStage, entry.oldLevel, entry.newLevel, entry.score]
    );
  }

  // Seed ownership records (one per demo user)
  const ownershipEntries = [
    { guardianId: 3, walletAddress: 'staging-demo-wallet-alice', userId: 1, username: 'alice' },
    { guardianId: 4, walletAddress: 'staging-demo-wallet-bob', userId: 2, username: 'bob' }
  ];

  for (const entry of ownershipEntries) {
    await pool.query(
      `INSERT INTO guardian_ownership (guardian_id, wallet_address, user_id, username, minted_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (guardian_id) DO NOTHING`,
      [entry.guardianId, entry.walletAddress, entry.userId, entry.username]
    );

    await pool.query(
      `UPDATE guardian SET status = 'MINTED' WHERE id = $1 AND status != 'MINTED'`,
      [entry.guardianId]
    );
  }

  // Seed metadata registry entries (synced from ownership + evolution)
  const registryEntries = [
    { userId: 1, username: 'alice', guardianId: 3, score: 150, level: 2, stage: 'AWAKENED', fgHours: 100, peerCount: 5, uptime: 95.5 },
    { userId: 2, username: 'bob', guardianId: 4, score: 350, level: 3, stage: 'ASCENDANT', fgHours: 250, peerCount: 12, uptime: 98.0 }
  ];

  for (const entry of registryEntries) {
    await pool.query(
      `INSERT INTO guardian_metadata_registry (user_id, username, guardian_id, contribution_score, level, stage, fg_hours, peer_count, uptime)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (user_id) DO UPDATE SET
         guardian_id = $3,
         contribution_score = $4,
         level = $5,
         stage = $6,
         fg_hours = $7,
         peer_count = $8,
         uptime = $9,
         updated_at = NOW()`,
      [entry.userId, entry.username, entry.guardianId, entry.score, entry.level, entry.stage, entry.fgHours, entry.peerCount, entry.uptime]
    );
  }

}

function startCleanupWorker() {
  const CLEANUP_INTERVAL = 60 * 60 * 1000;

  setInterval(async () => {
    try {
      const localPool = new Pool({ connectionString: process.env.DATABASE_URL });
      const result = await localPool.query(
        `DELETE FROM guardian_reservation WHERE expires_at <= NOW() RETURNING *`
      );

      for (const reservation of result.rows) {
        await localPool.query(
          `UPDATE guardian SET status = 'AVAILABLE' WHERE id = $1`,
          [reservation.guardian_id]
        );

        await localPool.query(
          `INSERT INTO guardian_audit_log (guardian_id, wallet_address, user_id, username, event, metadata)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [reservation.guardian_id, reservation.wallet_address, reservation.user_id, reservation.username, 'EXPIRED', JSON.stringify({ expiresAt: reservation.expires_at })]
        );

        await localPool.query(
          `INSERT INTO guardian_audit_log (guardian_id, wallet_address, user_id, username, event, metadata)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [reservation.guardian_id, reservation.wallet_address, reservation.user_id, reservation.username, 'RELEASED', JSON.stringify({ reason: 'reservation_expired' })]
        );
      }

      console.log(`[Cleanup] Released ${result.rows.length} expired reservations`);
      await localPool.end();
    } catch (err) {
      console.error('[Cleanup] Error:', err);
    }
  }, CLEANUP_INTERVAL);
}

async function start() {
  try {
    // Create HTTP server and upgrade to WebSocket
    const server = http.createServer(app);
    wss = new WebSocket.Server({ server });

    wss.on('connection', (ws) => {
      allClients.add(ws);

      ws.on('message', async (data) => {
        try {
          const msg = JSON.parse(data);

          if (msg.type === 'register') {
            const token = msg.token;
            if (!token || !JWT_SECRET) {
              ws.send(JSON.stringify({ type: 'error', error: 'No token provided' }));
              ws.close();
              return;
            }

            let user;
            try {
              user = jwt.verify(token, JWT_SECRET);
            } catch (err) {
              ws.send(JSON.stringify({ type: 'error', error: 'Invalid token' }));
              ws.close();
              return;
            }

            const userId = user.id;
            const username = user.username;
            const guardianId = msg.guardian_id;
            const guardianName = msg.guardian_name;
            const guardianTier = msg.guardian_tier;

            // Store session in database
            const sessionToken = `session-${userId}-${Date.now()}-${Math.random()}`;

            // Store connection for P2P signaling
            wsConnections.set(userId, { socket: ws, sessionToken, username, guardian_id: guardianId, guardian_name: guardianName, guardian_tier: guardianTier });
            ws.userId = userId;
            ws.sessionToken = sessionToken;

            ws.send(JSON.stringify({ type: 'registered', user_id: userId }));
          } else if (msg.type === 'heartbeat') {
            // Heartbeat acknowledged, connection still active
          } else if (msg.type === 'unregister') {
            if (ws.userId) {
              wsConnections.delete(ws.userId);
            }
          }
        } catch (err) {
          console.error('WebSocket message error:', err);
          ws.send(JSON.stringify({ type: 'error', error: err.message }));
        }
      });

      ws.on('close', () => {
        allClients.delete(ws);
        if (ws.userId) {
          wsConnections.delete(ws.userId);
        }
      });

      ws.on('error', (err) => {
        console.error('WebSocket error:', err);
      });
    });

    server.listen(port, () => {
      console.log(`Listening on :${port}`);
    });

    // Apply migrations and seed data in the background
    try {
      await applyMigrations();
      await seedStagingData();
      startCleanupWorker();

      console.log('Migrations and seeding complete');
    } catch (err) {
      console.error('Migration/seeding error:', err);
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

start();
