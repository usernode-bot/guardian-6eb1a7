const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const USERNODE_JWT_PUBLIC_KEY = process.env.USERNODE_JWT_PUBLIC_KEY;
const IS_STAGING = process.env.USERNODE_ENV === 'staging';

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Auth middleware - follows Usernode platform conventions
const PUBLIC_API_PATHS = new Set(['/health', '/api/state']);
// NOTE: /api/groups is deliberately NOT listed here. Group membership is
// per-user data, so every group route must run against a verified req.user.
const PUBLIC_PREFIXES = ['/explorer-api/', '/api/conversations'];

app.use((req, res, next) => {
  const token = req.query.token || req.headers['x-usernode-token'];
  if (token && USERNODE_JWT_PUBLIC_KEY) {
    try {
      const payload = jwt.verify(token, USERNODE_JWT_PUBLIC_KEY, {
        algorithms: ['RS256'],
        issuer: 'usernode',
        audience: 'usernode:app:' + process.env.USERNODE_APP_ID
      });
      if (payload.pur === 'iframe') {
        req.user = payload;
      }
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
let shuttingDown = false;
app.get('/health', (req, res) => {
  if (shuttingDown) return res.status(503).json({ status: 'shutting_down' });
  res.json({ status: 'ok' });
});

// App state endpoint
app.get('/api/state', (req, res) => {
  res.json({ status: 'ok', user: req.user || null });
});

// ---------------------------------------------------------------------------
// Group helpers
// ---------------------------------------------------------------------------

const MAX_NAME_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 250;
const MAX_INVITEES = 50;

// Ids stay in the `group_<token>` shape the hash router and the frontend
// fixtures already use, so /#/group/:id keeps working unchanged.
function generateGroupId() {
  return 'group_' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
}

function defaultAvatar(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  if (words.length > 1) {
    return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
  }
  return words[0].charAt(0).toUpperCase();
}

// Normalise the invitee list: accepts the `members: [{id, username}]` shape and
// the legacy `userIds: [...]` shape, dedupes, drops blanks and the requester.
function normalizeInvitees(body, requesterId) {
  const raw = [];
  if (Array.isArray(body && body.members)) {
    body.members.forEach((m) => {
      if (!m) return;
      if (typeof m === 'string') raw.push({ id: m, username: m });
      else raw.push({ id: m.id, username: m.username });
    });
  } else if (Array.isArray(body && body.userIds)) {
    body.userIds.forEach((id) => raw.push({ id, username: id }));
  }

  const seen = new Set();
  const out = [];
  raw.forEach((entry) => {
    const id = typeof entry.id === 'string' ? entry.id.trim() : '';
    if (!id) return;
    if (id === requesterId) return; // you're already in your own group
    if (seen.has(id)) return;
    seen.add(id);
    const username = typeof entry.username === 'string' && entry.username.trim()
      ? entry.username.trim().slice(0, 80)
      : id;
    out.push({ id, username });
  });
  return out;
}

// Shape a group row (+ members) the way the frontend already consumes groups.
function shapeGroup(row, memberRows) {
  const members = (memberRows || []).map((m) => ({
    id: m.user_id,
    username: m.username,
    role: m.role
  }));
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    avatar: row.avatar || defaultAvatar(row.name),
    visibility: row.visibility,
    creatorId: row.creator_user_id,
    creatorUsername: row.creator_username,
    createdAt: new Date(row.created_at).getTime(),
    memberCount: row.member_count !== undefined && row.member_count !== null
      ? Number(row.member_count)
      : members.length,
    members,
    isNew: row.is_new === undefined ? undefined : !!row.is_new
  };
}

async function loadGroupWithMembers(groupId) {
  const groupRes = await pool.query('SELECT * FROM groups WHERE id = $1', [groupId]);
  if (groupRes.rowCount === 0) return null;
  const memberRes = await pool.query(
    `SELECT user_id, username, role FROM group_members
      WHERE group_id = $1
      ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, joined_at`,
    [groupId]
  );
  const row = groupRes.rows[0];
  row.member_count = memberRes.rowCount;
  return shapeGroup(row, memberRes.rows);
}

async function memberRole(groupId, userId) {
  const res = await pool.query(
    'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2',
    [groupId, userId]
  );
  return res.rowCount === 0 ? null : res.rows[0].role;
}

// ---------------------------------------------------------------------------
// Group Management API Endpoints
// ---------------------------------------------------------------------------

// GET /api/groups?scope=mine|discover - list the caller's groups, or public
// groups they haven't joined yet (the Discover feed).
app.get('/api/groups', async (req, res) => {
  const scope = req.query.scope === 'discover' ? 'discover' : 'mine';
  try {
    if (scope === 'discover') {
      const result = await pool.query(
        `SELECT g.*,
                (SELECT COUNT(*) FROM group_members m WHERE m.group_id = g.id) AS member_count,
                (g.created_at > now() - interval '7 days') AS is_new
           FROM groups g
          WHERE g.visibility = 'public'
            AND NOT EXISTS (
              SELECT 1 FROM group_members m
               WHERE m.group_id = g.id AND m.user_id = $1
            )
          ORDER BY g.created_at DESC
          LIMIT 100`,
        [req.user.id]
      );
      return res.json({ groups: result.rows.map((row) => shapeGroup(row, [])) });
    }

    const result = await pool.query(
      `SELECT g.*,
              (SELECT COUNT(*) FROM group_members m WHERE m.group_id = g.id) AS member_count
         FROM groups g
        WHERE EXISTS (
                SELECT 1 FROM group_members m
                 WHERE m.group_id = g.id AND m.user_id = $1
              )
        ORDER BY g.created_at DESC
        LIMIT 100`,
      [req.user.id]
    );
    if (result.rowCount === 0) return res.json({ groups: [] });

    const ids = result.rows.map((r) => r.id);
    const memberRes = await pool.query(
      `SELECT group_id, user_id, username, role FROM group_members
        WHERE group_id = ANY($1::text[])
        ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, joined_at`,
      [ids]
    );
    const byGroup = new Map();
    memberRes.rows.forEach((m) => {
      if (!byGroup.has(m.group_id)) byGroup.set(m.group_id, []);
      byGroup.get(m.group_id).push(m);
    });
    res.json({ groups: result.rows.map((row) => shapeGroup(row, byGroup.get(row.id) || [])) });
  } catch (err) {
    console.error('[groups] list failed:', err);
    res.status(500).json({ error: 'Failed to load groups' });
  }
});

// GET /api/groups/:groupId - Fetch group details. Public groups are readable by
// anyone; a private group 404s for non-members so its existence never leaks.
app.get('/api/groups/:groupId', async (req, res) => {
  try {
    const group = await loadGroupWithMembers(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (group.visibility === 'private') {
      const role = await memberRole(group.id, req.user.id);
      if (!role) return res.status(404).json({ error: 'Group not found' });
    }
    res.json({ group });
  } catch (err) {
    console.error('[groups] fetch failed:', err);
    res.status(500).json({ error: 'Failed to load group' });
  }
});

// POST /api/groups - Create a new group with the creator as owner and at least
// one invited member.
app.post('/api/groups', async (req, res) => {
  const { name, description, avatar, visibility } = req.body || {};

  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (!trimmedName) {
    return res.status(400).json({ error: 'Group name is required' });
  }
  if (trimmedName.length > MAX_NAME_LENGTH) {
    return res.status(400).json({ error: 'Group name must be 50 characters or less' });
  }

  const trimmedDescription = typeof description === 'string' ? description.trim() : '';
  if (trimmedDescription.length > MAX_DESCRIPTION_LENGTH) {
    return res.status(400).json({ error: 'Description must be 250 characters or less' });
  }

  // Fail closed: anything that isn't an explicit 'public' is private.
  const groupVisibility = visibility === 'public' ? 'public' : 'private';

  const invitees = normalizeInvitees(req.body, req.user.id);
  if (invitees.length < 1) {
    return res.status(400).json({ error: 'Select at least 1 member' });
  }
  if (invitees.length > MAX_INVITEES) {
    return res.status(400).json({ error: 'You can invite at most 50 members' });
  }

  const groupId = generateGroupId();
  const avatarValue = typeof avatar === 'string' && avatar ? avatar : defaultAvatar(trimmedName);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO groups (id, name, description, avatar, visibility, creator_user_id, creator_username)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        groupId,
        trimmedName,
        trimmedDescription,
        avatarValue,
        groupVisibility,
        req.user.id,
        req.user.username || req.user.id
      ]
    );
    await client.query(
      `INSERT INTO group_members (group_id, user_id, username, role, invited_by_user_id)
       VALUES ($1, $2, $3, 'owner', NULL)
       ON CONFLICT (group_id, user_id) DO NOTHING`,
      [groupId, req.user.id, req.user.username || req.user.id]
    );
    for (const invitee of invitees) {
      await client.query(
        `INSERT INTO group_members (group_id, user_id, username, role, invited_by_user_id)
         VALUES ($1, $2, $3, 'member', $4)
         ON CONFLICT (group_id, user_id) DO NOTHING`,
        [groupId, invitee.id, invitee.username, req.user.id]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (rollbackErr) { /* already failed */ }
    console.error('[groups] create failed:', err);
    client.release();
    return res.status(500).json({ error: 'Failed to create group' });
  }
  client.release();

  try {
    const group = await loadGroupWithMembers(groupId);
    res.status(201).json({ group });
  } catch (err) {
    console.error('[groups] create readback failed:', err);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// POST /api/groups/:groupId/join - Join a public group. Idempotent.
app.post('/api/groups/:groupId/join', async (req, res) => {
  const { groupId } = req.params;
  try {
    const groupRes = await pool.query('SELECT visibility FROM groups WHERE id = $1', [groupId]);
    if (groupRes.rowCount === 0) return res.status(404).json({ error: 'Group not found' });
    if (groupRes.rows[0].visibility !== 'public') {
      return res.status(403).json({ error: 'This group is invite only' });
    }

    await pool.query(
      `INSERT INTO group_members (group_id, user_id, username, role, invited_by_user_id)
       VALUES ($1, $2, $3, 'member', NULL)
       ON CONFLICT (group_id, user_id) DO NOTHING`,
      [groupId, req.user.id, req.user.username || req.user.id]
    );

    const group = await loadGroupWithMembers(groupId);
    res.json({ group });
  } catch (err) {
    console.error('[groups] join failed:', err);
    res.status(500).json({ error: 'Failed to join group' });
  }
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

// PUT /api/groups/:groupId/avatar - Update group avatar
app.put('/api/groups/:groupId/avatar', (req, res) => {
  const { avatar } = req.body;
  const { groupId } = req.params;

  if (!avatar) {
    return res.status(400).json({ error: 'Avatar is required' });
  }

  // TODO: Validate user is group creator/admin
  // TODO: Store avatar (base64 for now, cloud storage in future)
  // TODO: Update database
  res.json({ id: groupId, avatar });
});

// POST /api/groups/:groupId/members - Add members to group (owner/admin only)
app.post('/api/groups/:groupId/members', async (req, res) => {
  const { groupId } = req.params;

  const invitees = normalizeInvitees(req.body, req.user.id);
  if (invitees.length === 0) {
    return res.status(400).json({ error: 'At least one member must be selected' });
  }
  if (invitees.length > MAX_INVITEES) {
    return res.status(400).json({ error: 'You can invite at most 50 members' });
  }

  try {
    const groupRes = await pool.query('SELECT id FROM groups WHERE id = $1', [groupId]);
    if (groupRes.rowCount === 0) return res.status(404).json({ error: 'Group not found' });

    const role = await memberRole(groupId, req.user.id);
    if (role !== 'owner' && role !== 'admin') {
      return res.status(403).json({ error: 'Only owners and admins can add members' });
    }

    for (const invitee of invitees) {
      await pool.query(
        `INSERT INTO group_members (group_id, user_id, username, role, invited_by_user_id)
         VALUES ($1, $2, $3, 'member', $4)
         ON CONFLICT (group_id, user_id) DO NOTHING`,
        [groupId, invitee.id, invitee.username, req.user.id]
      );
    }

    const group = await loadGroupWithMembers(groupId);
    res.json({
      id: groupId,
      members: group.members,
      memberCount: group.memberCount,
      message: 'Members added successfully'
    });
  } catch (err) {
    console.error('[groups] add members failed:', err);
    res.status(500).json({ error: 'Failed to add members' });
  }
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

// PUT /api/groups/:groupId/members/:memberId/role - Promote/demote a member (owner only)
app.put('/api/groups/:groupId/members/:memberId/role', (req, res) => {
  const { groupId, memberId } = req.params;
  const { role } = req.body;

  if (role !== 'admin' && role !== 'member') {
    return res.status(400).json({ error: 'Role must be "admin" or "member"' });
  }

  // TODO: Validate requesting user is the group owner
  // TODO: Prevent changing the owner's own role
  // TODO: Update database
  res.json({
    id: groupId,
    memberId,
    role,
    message: 'Member role updated successfully'
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

// POST /api/groups/:groupId/join-requests - Request to join a private group
app.post('/api/groups/:groupId/join-requests', (req, res) => {
  const { groupId } = req.params;

  // TODO: Validate group exists and is private
  // TODO: Validate user isn't already a member or already has a pending request
  // TODO: Update database
  res.json({
    id: groupId,
    message: 'Join request sent'
  });
});

// POST /api/groups/:groupId/join-requests/:requestId/approve - Approve a join request
app.post('/api/groups/:groupId/join-requests/:requestId/approve', (req, res) => {
  const { groupId, requestId } = req.params;

  // TODO: Validate user is group creator/admin
  // TODO: Move requester into group_members with role 'member'
  // TODO: Update database
  // TODO: Add system message to chat
  res.json({
    id: groupId,
    requestId,
    message: 'Join request approved'
  });
});

// POST /api/groups/:groupId/join-requests/:requestId/deny - Deny a join request
app.post('/api/groups/:groupId/join-requests/:requestId/deny', (req, res) => {
  const { groupId, requestId } = req.params;

  // TODO: Validate user is group creator/admin
  // TODO: Update database
  res.json({
    id: groupId,
    requestId,
    message: 'Join request denied'
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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        avatar TEXT NOT NULL DEFAULT '',
        visibility TEXT NOT NULL DEFAULT 'private'
          CHECK (visibility IN ('public', 'private')),
        creator_user_id TEXT NOT NULL,
        creator_username TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS group_members (
        id BIGSERIAL PRIMARY KEY,
        group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member'
          CHECK (role IN ('owner', 'admin', 'member')),
        invited_by_user_id TEXT,
        joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (group_id, user_id)
      );
    `);

    await pool.query(
      `CREATE INDEX IF NOT EXISTS groups_visibility_created_idx
         ON groups (visibility, created_at DESC)`
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS group_members_user_idx ON group_members (user_id)`
    );

    // Private: a private group's name/description is member-only content, and
    // group_members maps a username to every community they belong to — more
    // than a public profile exposes. Staging therefore gets schema only, which
    // is why the seed block below is mandatory.
    await pool.query(`COMMENT ON TABLE groups IS 'staging:private'`);
    await pool.query(`COMMENT ON TABLE group_members IS 'staging:private'`);

    console.log('Database initialized');
  } catch (err) {
    // Loud: if this fails the group routes will 500 on every call.
    console.error('FATAL: database initialization error:', err);
    throw err;
  }

  await seedStagingData();
}

// Staging seed. Both group tables are staging:private (schema-only copy), so
// without this a staging preview has no groups to discover or join at all.
// Strictly a no-op in production.
async function seedStagingData() {
  if (!IS_STAGING) return;

  const seeds = [
    {
      id: 'group_staging_public_1',
      name: 'Staging Demo Public Group',
      description: 'Staging demo group — public, so anyone can find and join it.',
      avatar: 'SP',
      visibility: 'public',
      owner: { id: 'staging-demo-user-1', username: 'staging-demo-owner' },
      members: [
        { id: 'staging-demo-user-2', username: 'staging-demo-ana' },
        { id: 'staging-demo-user-3', username: 'staging-demo-budi' }
      ]
    },
    {
      id: 'group_staging_public_2',
      name: 'Staging Demo Open Circle',
      description: 'Staging demo group — a second public group for the Discover list.',
      avatar: 'SO',
      visibility: 'public',
      owner: { id: 'staging-demo-user-2', username: 'staging-demo-ana' },
      members: [{ id: 'staging-demo-user-3', username: 'staging-demo-budi' }]
    },
    {
      id: 'group_staging_private_1',
      name: 'Staging Demo Private Group',
      description: 'Staging demo group — private, so it must never appear in Discover.',
      avatar: 'SR',
      visibility: 'private',
      owner: { id: 'staging-demo-user-1', username: 'staging-demo-owner' },
      members: [{ id: 'staging-demo-user-2', username: 'staging-demo-ana' }]
    }
  ];

  try {
    for (const seed of seeds) {
      await pool.query(
        `INSERT INTO groups (id, name, description, avatar, visibility, creator_user_id, creator_username)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [seed.id, seed.name, seed.description, seed.avatar, seed.visibility, seed.owner.id, seed.owner.username]
      );
      await pool.query(
        `INSERT INTO group_members (group_id, user_id, username, role, invited_by_user_id)
         VALUES ($1, $2, $3, 'owner', NULL)
         ON CONFLICT (group_id, user_id) DO NOTHING`,
        [seed.id, seed.owner.id, seed.owner.username]
      );
      for (const member of seed.members) {
        await pool.query(
          `INSERT INTO group_members (group_id, user_id, username, role, invited_by_user_id)
           VALUES ($1, $2, $3, 'member', $4)
           ON CONFLICT (group_id, user_id) DO NOTHING`,
          [seed.id, member.id, member.username, seed.owner.id]
        );
      }
    }
    console.log('Staging demo groups seeded');
  } catch (err) {
    console.error('Staging seed error:', err);
  }
}

// Start server
const server = app.listen(PORT, async () => {
  console.log(`Server listening on port ${PORT}`);
  try {
    await initDatabase();
  } catch (err) {
    console.error('Database schema unavailable — group endpoints will fail.');
  }
});

// Graceful shutdown: the platform SIGTERMs the container on every deploy and
// gives it a few seconds before SIGKILL.
const DRAIN_MS = 3000;

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
