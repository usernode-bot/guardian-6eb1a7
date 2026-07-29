const express = require('express');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const {
  ensureUsernodeUsernamesSchema,
  recordUsernodeUser,
  getSuggestedUsernodeUsers,
  searchUsernodeUsernames
} = require('./usernode-usernames');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

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
      recordUsernodeUser(pool, req.user).catch((err) => {
        console.error('Failed to record Usernode user:', err);
      });
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

// POST /api/groups - Create a new group
app.post('/api/groups', (req, res) => {
  const { name, description, visibility } = req.body;

  if (!name || name.trim().length === 0) {
    return res.status(400).json({ error: 'Group name is required' });
  }

  const groupVisibility = visibility === 'public' ? 'public' : 'private';

  // TODO: Persist group with creator as owner
  // TODO: Update database
  res.json({
    id: 'group_' + Date.now(),
    name: name.trim(),
    description: description || '',
    visibility: groupVisibility,
    message: 'Group created successfully'
  });
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

// POST /api/groups/:groupId/members - Add members to group
app.post('/api/groups/:groupId/members', (req, res) => {
  const { userIds } = req.body;
  const { groupId } = req.params;

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: 'At least one member must be selected' });
  }

  // TODO: Validate user is group creator/admin (only owner/admin roles may add members)
  // TODO: Validate users exist
  // TODO: Check for duplicates
  // TODO: Update database - new members are added with role 'member'
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

// Real Usernode Users API Endpoints

// GET /api/users/suggested - Suggested real Usernode users for the Create menu
app.get('/api/users/suggested', async (req, res) => {
  try {
    const users = await getSuggestedUsernodeUsers(pool, { excludeUserId: req.user.id, limit: 20 });
    res.json({ users });
  } catch (err) {
    console.error('Failed to fetch suggested users:', err);
    res.status(500).json({ error: 'Failed to fetch suggested users' });
  }
});

// GET /api/users/search?q= - Search real Usernode users by username or wallet address
app.get('/api/users/search', async (req, res) => {
  const query = (req.query.q || '').trim();
  if (!query) {
    return res.json({ users: [] });
  }

  try {
    const users = await searchUsernodeUsernames(pool, { query, excludeUserId: req.user.id, limit: 20 });
    res.json({ users });
  } catch (err) {
    console.error('Failed to search users:', err);
    res.status(500).json({ error: 'Failed to search users' });
  }
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
    await ensureUsernodeUsernamesSchema(pool);
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

module.exports = app;
