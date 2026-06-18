const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 3000;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const JWT_SECRET = process.env.JWT_SECRET;
const IS_STAGING = process.env.USERNODE_ENV === 'staging';

// Paths that stay open without authentication. Add a path here (and add it
// with `app.get`/`app.post` below) if you deliberately want it public.
// Everything else requires a valid platform-issued JWT.
const PUBLIC_API_PATHS = new Set(['/health', '/api/node', '/favicon.ico']);

app.use(express.json());

// Verify platform-issued JWT if one was passed, then enforce auth on
// anything not explicitly marked public. The iframe adds `?token=…`
// on load; the frontend script forwards the token via `x-usernode-token`
// on subsequent fetches.
app.use((req, res, next) => {
  const token = req.query.token || req.headers['x-usernode-token'];
  if (token && JWT_SECRET) {
    try { req.user = jwt.verify(token, JWT_SECRET); } catch {}
  }

  // Static assets (CSS/JS/images) are always served; the API and the HTML
  // shell are gated so direct hits to the staging/prod subdomain don't
  // leak app data to the public internet.
  if (req.method !== 'GET' || req.path.startsWith('/api/')) {
    if (PUBLIC_API_PATHS.has(req.path)) return next();
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Guardian API routes (stub implementations)
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
    res.json({
      status: 'online',
      uptimeSeconds: 259200,
      peers: 12,
      blockHeight: 1234567,
      lastBlockTime: '2 min ago'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/wallet', async (req, res) => {
  try {
    res.json({
      address: req.user ? (req.user.usernode_pubkey || null) : null,
      balance: '0 UT'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use(express.static(path.join(__dirname, 'public')));

// HTML shell: serve the app if authenticated, otherwise an "open in Usernode"
// landing page so stray visits to the staging URL don't reveal the app.
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

async function start() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS guardian_state (
      user_id INTEGER PRIMARY KEY,
      username VARCHAR(255) NOT NULL,
      guardian_name VARCHAR(100) NOT NULL DEFAULT 'Guardian',
      mood VARCHAR(20) NOT NULL DEFAULT 'neutral',
      health INTEGER NOT NULL DEFAULT 80,
      energy INTEGER NOT NULL DEFAULT 60,
      level INTEGER NOT NULL DEFAULT 1,
      xp INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  if (IS_STAGING) {
    await pool.query(`
      INSERT INTO guardian_state (user_id, username, guardian_name, mood, health, energy, level, xp)
      VALUES (-1, 'demo-user-1', 'Demo Guardian', 'happy', 90, 75, 3, 45)
      ON CONFLICT (user_id) DO NOTHING
    `);
    await pool.query(`
      INSERT INTO guardian_state (user_id, username, guardian_name, mood, health, energy, level, xp)
      VALUES (-2, 'demo-user-2', 'Sleepy Bot', 'tired', 40, 20, 1, 10)
      ON CONFLICT (user_id) DO NOTHING
    `);
  }

  app.listen(port, () => console.log(`Listening on :${port}`));
}

start().catch(err => { console.error(err); process.exit(1); });
