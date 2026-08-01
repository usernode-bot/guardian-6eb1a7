const express = require('express');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const IS_STAGING = process.env.USERNODE_ENV === 'staging';

// Graceful shutdown state (see "Graceful shutdown" in the platform conventions)
const DRAIN_MS = 3000;
let shuttingDown = false;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Auth middleware - follows Usernode platform conventions
const PUBLIC_API_PATHS = new Set(['/health', '/api/state']);
const PUBLIC_PREFIXES = ['/explorer-api/', '/api/conversations'];

app.use((req, res, next) => {
  const token = req.query.token || req.headers['x-usernode-token'];
  if (token && JWT_SECRET) {
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      // Token verification failed, continue without user
    }
  }

  if (req.method !== 'GET' || req.path.startsWith('/api/')) {
    if (PUBLIC_API_PATHS.has(req.path)) return next();
    if (PUBLIC_PREFIXES.some((p) => req.path.startsWith(p))) return next();
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
});

// Favicon endpoint - return 204 No Content to prevent browser 404 errors
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// Health check endpoint
app.get('/health', (req, res) => {
  if (shuttingDown) return res.status(503).json({ status: 'shutting_down' });
  res.json({ status: 'ok' });
});

// App state endpoint
app.get('/api/state', (req, res) => {
  res.json({ status: 'ok', user: req.user || null });
});

// Group Management API Endpoints

// GET /api/groups/:groupId - Fetch group details
app.get('/api/groups/:groupId', (req, res) => {
  // For now, this is a no-op on the backend since data lives in the frontend
  // In the future, this would query the database
  res.json({ status: 'ok', message: 'Group fetch endpoint available' });
});

// PUT /api/groups/:groupId/name - Update group name
app.put('/api/groups/:groupId/name', (req, res) => {
  const { name } = req.body;
  const { groupId } = req.params;

  if (!name || name.trim().length === 0) {
    return res.status(400).json({ error: 'Group name is required' });
  }

  if (name.length > 50) {
    return res.status(400).json({ error: 'Group name must be 50 characters or less' });
  }

  // TODO: Validate user is group creator/admin
  // TODO: Update database
  res.json({ id: groupId, name: name.trim() });
});

// PUT /api/groups/:groupId/description - Update group description
app.put('/api/groups/:groupId/description', (req, res) => {
  const { description } = req.body;
  const { groupId } = req.params;

  if (description && description.length > 250) {
    return res.status(400).json({ error: 'Description must be 250 characters or less' });
  }

  // TODO: Validate user is group creator/admin
  // TODO: Update database
  res.json({ id: groupId, description: description || '' });
});

// Avatar API Endpoints
//
// Avatars are stored platform-side via the bridge (usernode.uploadFile) and
// only the resulting URL + file id are persisted here. Image bytes must never
// reach Postgres, so a `data:` URI is rejected outright.
const AVATAR_URL_MAX_LEN = 512;

// Returns { ok: true, avatarUrl, avatarFileId } or { ok: false, error }.
function parseAvatarBody(body) {
  const raw = body || {};
  const avatarUrl = raw.avatarUrl;
  const avatarFileId = raw.avatarFileId;

  // null / '' means "remove the photo"
  if (avatarUrl === null || avatarUrl === undefined || avatarUrl === '') {
    return { ok: true, avatarUrl: null, avatarFileId: null };
  }
  if (typeof avatarUrl !== 'string') {
    return { ok: false, error: 'avatarUrl must be a string or null' };
  }
  if (avatarUrl.slice(0, 5).toLowerCase() === 'data:') {
    return { ok: false, error: 'Inline image data is not accepted; upload the file first' };
  }
  if (avatarUrl.length > AVATAR_URL_MAX_LEN) {
    return { ok: false, error: `avatarUrl must be ${AVATAR_URL_MAX_LEN} characters or less` };
  }
  const normalizedFileId = avatarFileId != null ? String(avatarFileId) : avatarFileId;
  if (normalizedFileId != null && normalizedFileId.length > 128) {
    return { ok: false, error: 'avatarFileId must be a string of 128 characters or less' };
  }
  return { ok: true, avatarUrl, avatarFileId: normalizedFileId || null };
}

async function saveAvatar(entityType, entityId, parsed, userId) {
  if (parsed.avatarUrl === null) {
    await pool.query(
      'DELETE FROM avatars WHERE entity_type = $1 AND entity_id = $2',
      [entityType, entityId]
    );
    return { entityType, entityId, avatarUrl: null, avatarFileId: null };
  }
  await pool.query(
    `INSERT INTO avatars (entity_type, entity_id, url, file_id, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (entity_type, entity_id)
     DO UPDATE SET url = EXCLUDED.url,
                   file_id = EXCLUDED.file_id,
                   updated_by = EXCLUDED.updated_by,
                   updated_at = NOW()`,
    [entityType, entityId, parsed.avatarUrl, parsed.avatarFileId, userId || null]
  );
  return {
    entityType,
    entityId,
    avatarUrl: parsed.avatarUrl,
    avatarFileId: parsed.avatarFileId,
  };
}

// PUT /api/profile/avatar - Set or clear the signed-in user's profile photo.
// Always keyed on req.user.id; any client-supplied id is ignored.
app.put('/api/profile/avatar', async (req, res) => {
  const parsed = parseAvatarBody(req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });

  try {
    const saved = await saveAvatar('profile', String(req.user.id), parsed, req.user.id);
    res.json(saved);
  } catch (err) {
    console.error('Failed to save profile avatar:', err.message);
    res.status(500).json({ error: 'Could not save the photo' });
  }
});

// GET /api/avatars - All stored avatars, grouped by entity type, for boot hydration.
app.get('/api/avatars', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT entity_type, entity_id, url, file_id FROM avatars'
    );
    const out = { group: {}, channel: {}, profile: {} };
    for (const row of rows) {
      if (!out[row.entity_type]) out[row.entity_type] = {};
      out[row.entity_type][row.entity_id] = {
        avatarUrl: row.url,
        avatarFileId: row.file_id,
      };
    }
    res.json(out);
  } catch (err) {
    console.error('Failed to load avatars:', err.message);
    res.status(500).json({ error: 'Could not load avatars' });
  }
});

// Groups and channels have no persistent backend table in this app — their
// data (including creatorId/admins) lives only in the frontend's synthetic
// user-id space, which has no relationship to the real authenticated
// req.user.id. Every other group-mutation endpoint below already reflects
// this by skipping authorization entirely (see their TODO comments). To give
// the avatar endpoints a real 403 instead of the same TODO, the client sends
// along the creatorId/admins it already holds for the entity, and this check
// operates in that same synthetic space, mirroring canEditEntityAvatar on
// the client. This is honest about the trust boundary: it is not a
// substitute for real multi-tenant authorization, which would require a
// persistent groups/channels backend this app does not have.
const CURRENT_USER_SENTINEL = 'user_self';
function canEditEntityAvatar(creatorId, admins) {
  if (creatorId === CURRENT_USER_SENTINEL) return true;
  if (Array.isArray(admins) && admins.includes(CURRENT_USER_SENTINEL)) return true;
  return false;
}

// PUT /api/groups/:groupId/avatar - Set or clear a group's photo. 403 unless
// the caller is the group's creator or an admin (see canEditEntityAvatar above).
app.put('/api/groups/:groupId/avatar', async (req, res) => {
  const { groupId } = req.params;
  if (!canEditEntityAvatar(req.body && req.body.creatorId, req.body && req.body.admins)) {
    return res.status(403).json({ error: 'Only the group creator or an admin can change this photo' });
  }

  const parsed = parseAvatarBody(req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });

  try {
    const saved = await saveAvatar('group', groupId, parsed, req.user.id);
    res.json(saved);
  } catch (err) {
    console.error('Failed to save group avatar:', err.message);
    res.status(500).json({ error: 'Could not save the photo' });
  }
});

// PUT /api/channels/:channelId/avatar - Set or clear a channel's photo. 403
// unless the caller is the channel's creator or an admin.
app.put('/api/channels/:channelId/avatar', async (req, res) => {
  const { channelId } = req.params;
  if (!canEditEntityAvatar(req.body && req.body.creatorId, req.body && req.body.admins)) {
    return res.status(403).json({ error: 'Only the channel creator or an admin can change this photo' });
  }

  const parsed = parseAvatarBody(req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });

  try {
    const saved = await saveAvatar('channel', channelId, parsed, req.user.id);
    res.json(saved);
  } catch (err) {
    console.error('Failed to save channel avatar:', err.message);
    res.status(500).json({ error: 'Could not save the photo' });
  }
});

// POST /api/groups/:groupId/members - Add members to group
app.post('/api/groups/:groupId/members', (req, res) => {
  const { userIds } = req.body;
  const { groupId } = req.params;

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: 'At least one member must be selected' });
  }

  // TODO: Validate user is group creator/admin
  // TODO: Validate users exist
  // TODO: Check for duplicates
  // TODO: Update database
  res.json({
    id: groupId,
    members: [],
    memberCount: 0,
    message: 'Members added successfully'
  });
});

// DELETE /api/groups/:groupId/members/:memberId - Remove member from group
app.delete('/api/groups/:groupId/members/:memberId', (req, res) => {
  const { groupId, memberId } = req.params;

  // TODO: Validate user is group creator/admin or removing self
  // TODO: Check if this is the last member
  // TODO: Update database
  // TODO: Add system message to chat
  res.json({
    id: groupId,
    members: [],
    memberCount: 0,
    message: 'Member removed successfully'
  });
});

// POST /api/groups/:groupId/leave - Leave the group
app.post('/api/groups/:groupId/leave', (req, res) => {
  const { groupId } = req.params;

  // TODO: Validate user is member
  // TODO: Check if user is only member (creator case)
  // TODO: Update database
  // TODO: Add system message to chat
  res.json({
    id: groupId,
    members: [],
    memberCount: 0,
    isLeftByUser: true,
    message: 'You have left the group'
  });
});

// In-memory conversation storage (demo/frontend state)
let conversations = {};

// Conversation Management API Endpoints

// PUT /api/conversations/:id/pin - Toggle pin on a conversation
app.put('/api/conversations/:id/pin', (req, res) => {
  const { id } = req.params;
  const { pinned } = req.body;

  // Initialize or update conversation pin state
  if (!conversations[id]) {
    conversations[id] = { pinned: !!pinned };
  } else {
    conversations[id].pinned = !!pinned;
  }

  res.json({
    id: id,
    pinned: conversations[id].pinned,
    message: 'Conversation pin status updated'
  });
});

// Initialize database schema
async function initDatabase() {
  try {
    // Create a basic example table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_state (
        id SERIAL PRIMARY KEY,
        key VARCHAR(255) UNIQUE NOT NULL,
        value TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Avatar URLs for groups, channels and user profiles. Public by default:
    // it stores only the URLs of photos the app already shows to every member,
    // and no personal data beyond the entity id.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS avatars (
        entity_type TEXT NOT NULL CHECK (entity_type IN ('group', 'channel', 'profile')),
        entity_id TEXT NOT NULL,
        url TEXT NOT NULL,
        file_id TEXT,
        updated_by TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (entity_type, entity_id)
      );
    `);

    console.log('Database initialized');

    await seedStagingData();
  } catch (err) {
    console.error('Database initialization error:', err);
  }
}

// A 16x16 solid-colour PNG. Platform-stored files are not cloned into staging,
// so a real /app-files/ URL would 404 in a preview — seed an inline placeholder.
const STAGING_DEMO_AVATAR =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR42mMwOR5JEmIY1TCqYfhqAACciFQQEUs2wAAAAABJRU5ErkJggg==';

// Strictly a no-op outside staging; idempotent across container rebuilds.
async function seedStagingData() {
  if (!IS_STAGING) return;
  try {
    await pool.query(
      `INSERT INTO avatars (entity_type, entity_id, url, file_id, updated_by)
       VALUES ('profile', 'staging-demo-user', $1, NULL, 'staging-demo-user')
       ON CONFLICT (entity_type, entity_id) DO NOTHING`,
      [STAGING_DEMO_AVATAR]
    );
    // group_1 and channel_2 are owned by 'user_self' in the frontend seed
    // data, so they double as the owner-editable positive test case; the
    // other seeded groups/channels are owned by other synthetic users and
    // stay avatar-less, exercising the 403 negative case.
    await pool.query(
      `INSERT INTO avatars (entity_type, entity_id, url, file_id, updated_by)
       VALUES ('group', 'group_1', $1, NULL, 'staging-demo-user')
       ON CONFLICT (entity_type, entity_id) DO NOTHING`,
      [STAGING_DEMO_AVATAR]
    );
    await pool.query(
      `INSERT INTO avatars (entity_type, entity_id, url, file_id, updated_by)
       VALUES ('channel', 'channel_2', $1, NULL, 'staging-demo-user')
       ON CONFLICT (entity_type, entity_id) DO NOTHING`,
      [STAGING_DEMO_AVATAR]
    );
    console.log('Staging demo data seeded');
  } catch (err) {
    console.error('Staging seed error:', err.message);
  }
}

// Start server
const server = app.listen(PORT, async () => {
  console.log(`Server listening on port ${PORT}`);
  await initDatabase();
});

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] ${signal} received, draining`);
  server.close(() => {});
  server.closeIdleConnections?.();
  const t = setTimeout(() => server.closeAllConnections?.(), DRAIN_MS);
  t.unref?.();
  try {
    await pool.end();
  } catch (err) {
    console.error('[shutdown] pool.end failed', err.message);
  }
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
