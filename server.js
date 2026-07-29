const express = require('express');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const PLATFORM_BASE_URL = process.env.PLATFORM_BASE_URL || 'https://social-vibecoding.usernodelabs.org';
const APP_SLUG = process.env.APP_SLUG || 'guardian';
const IS_STAGING = process.env.USERNODE_ENV === 'staging';

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

function decodeUser(req) {
  const token = req.query.token || req.headers['x-usernode-token'];
  if (token && JWT_SECRET) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (err) {
      // Token verification failed, treat as unauthenticated
    }
  }
  return null;
}

// Middleware
app.use(express.json());

app.use((req, res, next) => {
  req.user = decodeUser(req);
  next();
});

// Chromeless deep-link redirect: a shared link opened directly in a browser
// (not inside the platform's app iframe) can't authenticate itself here, so
// hand top-level unauthenticated document requests to the platform shell,
// which mints a real session and forwards the original path back in.
app.use((req, res, next) => {
  if (req.method === 'GET' && req.get('sec-fetch-dest') === 'document' && !req.user) {
    return res.redirect(`${PLATFORM_BASE_URL}/#app/${APP_SLUG}/full?path=${req.originalUrl}`);
  }
  next();
});

app.use(express.static('public'));

// Auth middleware - follows Usernode platform conventions
const PUBLIC_API_PATHS = new Set(['/health', '/api/state']);
const PUBLIC_PREFIXES = ['/explorer-api/', '/api/conversations'];

app.use((req, res, next) => {
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
  res.json({ status: 'ok' });
});

// App state endpoint
app.get('/api/state', (req, res) => {
  res.json({ status: 'ok', user: req.user || null });
});

// Returns the caller's role in a group: 'owner', the stored group_members
// role, or null if the group doesn't exist or the caller isn't a member.
// 'user_self' is this (single-real-user, mostly mock) app's placeholder for
// "whoever is logged in" -- the same sentinel the frontend already uses in
// isCurrentUserGroupAdmin -- so rows seeded against it match whichever real
// user is currently authenticated.
async function getGroupRole(groupId, userId) {
  const groupResult = await pool.query('SELECT creator_id FROM groups WHERE id = $1', [groupId]);
  if (groupResult.rows.length === 0) return null;

  const creatorId = groupResult.rows[0].creator_id;
  if (creatorId === userId || creatorId === 'user_self') return 'owner';

  const memberResult = await pool.query(
    'SELECT role FROM group_members WHERE group_id = $1 AND (user_id = $2 OR user_id = $3)',
    [groupId, userId, 'user_self']
  );
  return memberResult.rows.length > 0 ? memberResult.rows[0].role : null;
}

// Group Management API Endpoints

// GET /api/groups/:groupId - Fetch group details
app.get('/api/groups/:groupId', (req, res) => {
  // For now, this is a no-op on the backend since data lives in the frontend
  // In the future, this would query the database
  res.json({ status: 'ok', message: 'Group fetch endpoint available' });
});

// POST /api/groups - Create a new group
app.post('/api/groups', async (req, res) => {
  const { name, description, visibility } = req.body;

  if (!name || name.trim().length === 0) {
    return res.status(400).json({ error: 'Group name is required' });
  }

  const groupVisibility = visibility === 'public' ? 'public' : 'private';
  const groupId = 'group_' + Date.now();

  try {
    await pool.query(
      `INSERT INTO groups (id, name, description, visibility, creator_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [groupId, name.trim(), description || '', groupVisibility, req.user.id]
    );
    await pool.query(
      `INSERT INTO group_members (group_id, user_id, username, role)
       VALUES ($1, $2, $3, 'owner')
       ON CONFLICT (group_id, user_id) DO NOTHING`,
      [groupId, req.user.id, req.user.username]
    );
  } catch (err) {
    console.error('Failed to persist group:', err);
    return res.status(500).json({ error: 'Failed to create group' });
  }

  res.json({
    id: groupId,
    name: name.trim(),
    description: description || '',
    visibility: groupVisibility,
    message: 'Group created successfully'
  });
});

// PUT /api/groups/:groupId/name - Update group name
app.put('/api/groups/:groupId/name', async (req, res) => {
  const { name } = req.body;
  const { groupId } = req.params;

  if (!name || name.trim().length === 0) {
    return res.status(400).json({ error: 'Group name is required' });
  }

  if (name.length > 50) {
    return res.status(400).json({ error: 'Group name must be 50 characters or less' });
  }

  const role = await getGroupRole(groupId, req.user.id);
  if (role === null) {
    return res.status(404).json({ error: 'Group not found' });
  }
  if (role !== 'owner' && role !== 'admin') {
    return res.status(403).json({ error: 'Only the group creator or an admin can edit group info' });
  }

  await pool.query('UPDATE groups SET name = $1, updated_at = now() WHERE id = $2', [name.trim(), groupId]);
  res.json({ id: groupId, name: name.trim() });
});

// PUT /api/groups/:groupId/description - Update group description
app.put('/api/groups/:groupId/description', async (req, res) => {
  const { description } = req.body;
  const { groupId } = req.params;

  if (description && description.length > 250) {
    return res.status(400).json({ error: 'Description must be 250 characters or less' });
  }

  const role = await getGroupRole(groupId, req.user.id);
  if (role === null) {
    return res.status(404).json({ error: 'Group not found' });
  }
  if (role !== 'owner' && role !== 'admin') {
    return res.status(403).json({ error: 'Only the group creator or an admin can edit group info' });
  }

  await pool.query('UPDATE groups SET description = $1, updated_at = now() WHERE id = $2', [description || '', groupId]);
  res.json({ id: groupId, description: description || '' });
});

// PUT /api/groups/:groupId/avatar - Update group avatar
app.put('/api/groups/:groupId/avatar', async (req, res) => {
  const { avatar } = req.body;
  const { groupId } = req.params;

  if (!avatar) {
    return res.status(400).json({ error: 'Avatar is required' });
  }

  const role = await getGroupRole(groupId, req.user.id);
  if (role === null) {
    return res.status(404).json({ error: 'Group not found' });
  }
  if (role !== 'owner' && role !== 'admin') {
    return res.status(403).json({ error: 'Only the group creator or an admin can edit group info' });
  }

  // TODO: Store avatar (base64 for now, cloud storage in future)
  await pool.query('UPDATE groups SET avatar = $1, updated_at = now() WHERE id = $2', [avatar, groupId]);
  res.json({ id: groupId, avatar });
});

// POST /api/groups/:groupId/members - Add members to group
app.post('/api/groups/:groupId/members', async (req, res) => {
  const { userIds } = req.body;
  const { groupId } = req.params;

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: 'At least one member must be selected' });
  }

  try {
    for (const userId of userIds) {
      await pool.query(
        `INSERT INTO group_members (group_id, user_id, username, role)
         VALUES ($1, $2, $3, 'member')
         ON CONFLICT (group_id, user_id) DO NOTHING`,
        [groupId, userId, userId]
      );
    }
  } catch (err) {
    console.error('Failed to add members:', err);
    return res.status(500).json({ error: 'Failed to add members' });
  }

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

// PUT /api/groups/:groupId/members/:memberId/role - Promote/demote a member (owner only)
app.put('/api/groups/:groupId/members/:memberId/role', async (req, res) => {
  const { groupId, memberId } = req.params;
  const { role } = req.body;

  if (role !== 'admin' && role !== 'member') {
    return res.status(400).json({ error: 'Role must be "admin" or "member"' });
  }

  const requesterRole = await getGroupRole(groupId, req.user.id);
  if (requesterRole === null) {
    return res.status(404).json({ error: 'Group not found' });
  }
  if (requesterRole !== 'owner') {
    return res.status(403).json({ error: 'Only the group creator can change member roles' });
  }

  const targetRole = await getGroupRole(groupId, memberId);
  if (targetRole === 'owner') {
    return res.status(400).json({ error: "Cannot change the group creator's role" });
  }

  await pool.query('UPDATE group_members SET role = $1 WHERE group_id = $2 AND user_id = $3', [role, groupId, memberId]);
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
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        avatar TEXT,
        visibility VARCHAR(20) NOT NULL DEFAULT 'private',
        creator_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS group_members (
        group_id VARCHAR(255) NOT NULL REFERENCES groups(id),
        user_id VARCHAR(255) NOT NULL,
        username VARCHAR(255),
        role VARCHAR(20) NOT NULL DEFAULT 'member',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (group_id, user_id)
      );
    `);

    // Give the app's pre-existing hardcoded demo groups (Seeker Club / Design
    // Team, defined client-side in app.js) a matching backend row so the new
    // permission checks above have real data to check against rather than
    // only newly-created groups. Runs in every environment, not just staging,
    // since these two groups already exist identically in every environment's
    // frontend code.
    await pool.query(`
      INSERT INTO groups (id, name, description, visibility, creator_id)
      VALUES ('group_1', 'Seeker Club', 'A community of seekers and explorers', 'public', 'user_self')
      ON CONFLICT (id) DO NOTHING;
    `);
    await pool.query(`
      INSERT INTO group_members (group_id, user_id, username, role) VALUES
        ('group_1', 'user_self', 'You', 'owner'),
        ('group_1', 'user_alice', 'Alice', 'admin'),
        ('group_1', 'user_bob', 'Bob', 'member'),
        ('group_1', 'user_charlie', 'Charlie', 'member')
      ON CONFLICT (group_id, user_id) DO NOTHING;
    `);
    await pool.query(`
      INSERT INTO groups (id, name, description, visibility, creator_id)
      VALUES ('group_2', 'Design Team', 'Collaborate on visual designs and UI/UX', 'private', 'user_8')
      ON CONFLICT (id) DO NOTHING;
    `);
    await pool.query(`
      INSERT INTO group_members (group_id, user_id, username, role) VALUES
        ('group_2', 'user_self', 'You', 'member'),
        ('group_2', 'user_1', 'aksaranft', 'member'),
        ('group_2', 'user_8', 'designpro', 'owner')
      ON CONFLICT (group_id, user_id) DO NOTHING;
    `);

    if (IS_STAGING) {
      // Fake demo users/data for staging only -- no-op in production.
      await pool.query(`
        INSERT INTO groups (id, name, description, visibility, creator_id)
        VALUES ('staging-demo-group-1', 'Staging Demo Group', 'Seeded group for exercising role permissions in staging', 'public', 'staging-demo-user-1')
        ON CONFLICT (id) DO NOTHING;
      `);
      await pool.query(`
        INSERT INTO group_members (group_id, user_id, username, role) VALUES
          ('staging-demo-group-1', 'staging-demo-user-1', 'Staging Demo Owner', 'owner'),
          ('staging-demo-group-1', 'staging-demo-user-2', 'Staging Demo Admin', 'admin'),
          ('staging-demo-group-1', 'staging-demo-user-3', 'Staging Demo Member', 'member')
        ON CONFLICT (group_id, user_id) DO NOTHING;
      `);
    }

    console.log('Database initialized');
  } catch (err) {
    console.error('Database initialization error:', err);
  }
}

// Start server
const server = app.listen(PORT, async () => {
  console.log(`Server listening on port ${PORT}`);
  await initDatabase();
});

// Graceful shutdown - follows Usernode platform conventions
const DRAIN_MS = 3000;
let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}, draining connections...`);
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
  setTimeout(() => {
    console.log('Drain timeout exceeded, forcing exit');
    process.exit(0);
  }, DRAIN_MS).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
