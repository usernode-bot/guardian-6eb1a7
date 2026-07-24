const express = require('express');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

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
const PUBLIC_PREFIXES = ['/explorer-api/'];

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

// Profile API Endpoints

// GET /api/profile - Fetch current user's profile
app.get('/api/profile', async (req, res) => {
  try {
    const userId = req.user.id || req.user.username;
    const result = await pool.query(
      'SELECT bio FROM user_profiles WHERE user_id = $1',
      [userId]
    );

    const profile = result.rows[0];
    res.json({
      userId: req.user.id || req.user.username,
      username: req.user.username,
      usernode_pubkey: req.user.usernode_pubkey || null,
      bio: profile ? profile.bio : null,
      avatar: null,
      avatarUrl: '/api/profile/avatar'
    });
  } catch (err) {
    console.error('Error fetching profile:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PUT /api/profile/bio - Update user's bio
app.put('/api/profile/bio', async (req, res) => {
  try {
    const { bio } = req.body;
    const userId = req.user.id || req.user.username;

    if (bio && bio.length > 250) {
      return res.status(400).json({ error: 'Bio must be 250 characters or less' });
    }

    await pool.query(
      `INSERT INTO user_profiles (user_id, username, bio)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET bio = $3, updated_at = CURRENT_TIMESTAMP`,
      [userId, req.user.username, bio || null]
    );

    res.json({
      bio: bio || null,
      updated_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error updating bio:', err);
    res.status(500).json({ error: 'Failed to update bio' });
  }
});

// PUT /api/profile/avatar - Update user's avatar
app.put('/api/profile/avatar', async (req, res) => {
  try {
    const { avatar } = req.body;
    const userId = req.user.id || req.user.username;

    if (!avatar) {
      return res.status(400).json({ error: 'Avatar is required' });
    }

    // Handle base64 data URL
    let avatarBuffer;
    if (avatar.startsWith('data:')) {
      const base64Data = avatar.split(',')[1];
      avatarBuffer = Buffer.from(base64Data, 'base64');
    } else {
      avatarBuffer = Buffer.from(avatar, 'base64');
    }

    if (avatarBuffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Avatar must be 5MB or less' });
    }

    await pool.query(
      `INSERT INTO user_profiles (user_id, username, avatar)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET avatar = $3, updated_at = CURRENT_TIMESTAMP`,
      [userId, req.user.username, avatarBuffer]
    );

    res.json({
      avatarUrl: '/api/profile/avatar',
      updated_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error updating avatar:', err);
    res.status(500).json({ error: 'Failed to update avatar' });
  }
});

// GET /api/profile/avatar - Fetch current user's avatar image
app.get('/api/profile/avatar', async (req, res) => {
  try {
    const userId = req.user.id || req.user.username;
    const result = await pool.query(
      'SELECT avatar FROM user_profiles WHERE user_id = $1',
      [userId]
    );

    if (!result.rows[0] || !result.rows[0].avatar) {
      return res.status(204).end();
    }

    res.set('Content-Type', 'image/png');
    res.send(result.rows[0].avatar);
  } catch (err) {
    console.error('Error fetching avatar:', err);
    res.status(500).json({ error: 'Failed to fetch avatar' });
  }
});

// Initialize database schema
async function initDatabase() {
  try {
    // Create user_profiles table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL,
        bio TEXT,
        avatar BYTEA,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Mark table as private for staging
    await pool.query(`
      COMMENT ON TABLE user_profiles IS 'staging:private'
    `).catch(() => {
      // Ignore if comment already exists
    });

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

    // Seed staging data if in staging environment
    if (process.env.USERNODE_ENV === 'staging') {
      await pool.query(`
        INSERT INTO user_profiles (user_id, username, bio)
        VALUES ('staging-demo-user', 'staging-demo-user', 'Staging demo user bio')
        ON CONFLICT (user_id) DO NOTHING
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

module.exports = app;
