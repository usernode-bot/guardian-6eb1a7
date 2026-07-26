const express = require('express');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
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

// GET /api/profile - Fetch user profile
app.get('/api/profile', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const result = await pool.query(
      'SELECT * FROM user_profiles WHERE user_id = $1',
      [req.user.id]
    );

    const profile = result.rows[0] || {};
    res.json({
      user_id: req.user.id,
      username: req.user.username || null,
      wallet_address: req.user.usernode_pubkey || null,
      avatar_file_id: profile.avatar_file_id || null,
      avatar_url: profile.avatar_url || null,
      bio: profile.bio || null,
      updated_at: profile.updated_at || null
    });
  } catch (err) {
    console.error('Error fetching profile:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// POST /api/profile - Update user profile
app.post('/api/profile', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { bio, avatar_url, avatar_file_id } = req.body;

    // Validation: at least one field must be provided
    if (!bio && !avatar_url && !avatar_file_id) {
      return res.status(400).json({ error: 'At least one field must be provided' });
    }

    // Validation: bio must be <= 500 characters
    if (bio && bio.length > 500) {
      return res.status(400).json({ error: 'Bio must be 500 characters or less' });
    }

    // Upsert the profile
    const result = await pool.query(
      `INSERT INTO user_profiles (user_id, avatar_file_id, avatar_url, bio, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         avatar_file_id = COALESCE($2, user_profiles.avatar_file_id),
         avatar_url = COALESCE($3, user_profiles.avatar_url),
         bio = COALESCE($4, user_profiles.bio),
         updated_at = NOW()
       RETURNING *`,
      [req.user.id, avatar_file_id || null, avatar_url || null, bio || null]
    );

    const profile = result.rows[0];
    res.json({
      user_id: profile.user_id,
      username: req.user.username || null,
      wallet_address: req.user.usernode_pubkey || null,
      avatar_file_id: profile.avatar_file_id,
      avatar_url: profile.avatar_url,
      bio: profile.bio,
      updated_at: profile.updated_at
    });
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
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

    // Create user_profiles table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        user_id UUID PRIMARY KEY NOT NULL,
        avatar_file_id TEXT,
        avatar_url TEXT,
        bio TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Database initialized');

    // Seed demo user profiles in staging
    if (IS_STAGING) {
      const demoProfiles = [
        { user_id: '550e8400-e29b-41d4-a716-446655440001', username: 'aksaranft', bio: 'NFT enthusiast' },
        { user_id: '550e8400-e29b-41d4-a716-446655440002', username: 'cryptosmith', bio: 'Crypto developer' },
        { user_id: '550e8400-e29b-41d4-a716-446655440003', username: 'nodeart', bio: 'Digital artist' },
        { user_id: '550e8400-e29b-41d4-a716-446655440004', username: 'vibemaster', bio: 'Community builder' },
        { user_id: '550e8400-e29b-41d4-a716-446655440005', username: 'chainwizard', bio: 'Blockchain expert' },
        { user_id: '550e8400-e29b-41d4-a716-446655440008', username: 'designpro', bio: 'UI/UX designer' }
      ];

      for (const profile of demoProfiles) {
        await pool.query(
          `INSERT INTO user_profiles (user_id, bio)
           VALUES ($1, $2)
           ON CONFLICT (user_id) DO UPDATE SET bio = $2`,
          [profile.user_id, profile.bio]
        );
      }
    }
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
