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

// Get conversations by tab
app.get('/api/conversations', async (req, res) => {
  try {
    const { tab } = req.query;
    const userId = req.user.id;

    let typeFilter = '';
    if (tab === 'dm') typeFilter = "AND conversation_type = 'direct'";
    else if (tab === 'groups') typeFilter = "AND conversation_type = 'group'";
    else if (tab === 'channels') typeFilter = "AND conversation_type = 'channel'";

    const result = await pool.query(`
      SELECT id, conversation_type as type,
             COALESCE(other_user_id, group_id, channel_id) as other_id,
             last_message, last_message_timestamp, unread_count,
             is_pinned, is_muted, is_archived
      FROM conversations
      WHERE user_id = $1 AND is_archived = false ${typeFilter}
      ORDER BY is_pinned DESC, last_message_timestamp DESC
      LIMIT 100
    `, [userId]);

    res.json({ conversations: result.rows });
  } catch (err) {
    console.error('Error fetching conversations:', err);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Get requests
app.get('/api/requests', async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(`
      SELECT id, from_user_id, message_preview, created_at
      FROM requests
      WHERE to_user_id = $1 AND status = 'pending'
      ORDER BY created_at DESC
    `, [userId]);

    res.json({ requests: result.rows });
  } catch (err) {
    console.error('Error fetching requests:', err);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// Accept request
app.post('/api/requests/:requestId/accept', async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user.id;

    const requestResult = await pool.query(
      'SELECT from_user_id FROM requests WHERE id = $1 AND to_user_id = $2',
      [requestId, userId]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const fromUserId = requestResult.rows[0].from_user_id;

    // Update request status
    await pool.query(
      'UPDATE requests SET status = $1 WHERE id = $2',
      ['accepted', requestId]
    );

    // Create conversation
    const convResult = await pool.query(`
      INSERT INTO conversations (user_id, conversation_type, other_user_id, last_message_timestamp)
      VALUES ($1, $2, $3, NOW())
      RETURNING id
    `, [userId, 'direct', fromUserId]);

    res.json({ conversationId: convResult.rows[0].id, message: 'Request accepted' });
  } catch (err) {
    console.error('Error accepting request:', err);
    res.status(500).json({ error: 'Failed to accept request' });
  }
});

// Decline request
app.post('/api/requests/:requestId/decline', async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user.id;

    await pool.query(
      'UPDATE requests SET status = $1 WHERE id = $2 AND to_user_id = $3',
      ['declined', requestId, userId]
    );

    res.json({ message: 'Request declined' });
  } catch (err) {
    console.error('Error declining request:', err);
    res.status(500).json({ error: 'Failed to decline request' });
  }
});

// Search conversations
app.get('/api/conversations/search', async (req, res) => {
  try {
    const { q, tab } = req.query;
    const userId = req.user.id;

    let typeFilter = '';
    if (tab === 'dm') typeFilter = "AND conversation_type = 'direct'";
    else if (tab === 'groups') typeFilter = "AND conversation_type = 'group'";
    else if (tab === 'channels') typeFilter = "AND conversation_type = 'channel'";

    const result = await pool.query(`
      SELECT id, conversation_type as type,
             COALESCE(other_user_id, group_id, channel_id) as other_id,
             last_message, last_message_timestamp, unread_count
      FROM conversations
      WHERE user_id = $1 AND is_archived = false ${typeFilter}
      AND (LOWER(last_message) LIKE LOWER($2) OR id::text LIKE $2)
      ORDER BY last_message_timestamp DESC
      LIMIT 50
    `, [userId, `%${q}%`]);

    res.json({ results: result.rows });
  } catch (err) {
    console.error('Error searching conversations:', err);
    res.status(500).json({ error: 'Failed to search conversations' });
  }
});

// Update conversation (archive, pin, mute)
app.patch('/api/conversations/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { action } = req.query;
    const userId = req.user.id;

    let updateQuery = '';
    if (action === 'archive') {
      updateQuery = 'UPDATE conversations SET is_archived = true WHERE id = $1 AND user_id = $2';
    } else if (action === 'pin') {
      updateQuery = 'UPDATE conversations SET is_pinned = NOT is_pinned WHERE id = $1 AND user_id = $2';
    } else if (action === 'mute') {
      updateQuery = 'UPDATE conversations SET is_muted = NOT is_muted WHERE id = $1 AND user_id = $2';
    }

    if (updateQuery) {
      await pool.query(updateQuery, [conversationId, userId]);
      res.json({ message: 'Conversation updated' });
    } else {
      res.status(400).json({ error: 'Invalid action' });
    }
  } catch (err) {
    console.error('Error updating conversation:', err);
    res.status(500).json({ error: 'Failed to update conversation' });
  }
});

// Delete conversation
app.delete('/api/conversations/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    await pool.query(
      'DELETE FROM conversations WHERE id = $1 AND user_id = $2',
      [conversationId, userId]
    );

    res.json({ message: 'Conversation deleted' });
  } catch (err) {
    console.error('Error deleting conversation:', err);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

// Mark messages in a conversation as read
app.post('/api/conversations/:conversationId/mark-as-read', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    // Validate conversation exists and belongs to user
    const validateResult = await pool.query(
      'SELECT id FROM conversations WHERE id = $1 AND user_id = $2',
      [conversationId, userId]
    );

    if (validateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found or you do not have access' });
    }

    // Clear unread count for this conversation
    await pool.query(
      'UPDATE conversations SET unread_count = 0 WHERE id = $1 AND user_id = $2',
      [conversationId, userId]
    );

    res.json({ message: 'Conversation marked as read' });
  } catch (err) {
    console.error('Error marking conversation as read:', err);
    res.status(500).json({ error: 'Failed to mark conversation as read' });
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
    // Create conversations table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        conversation_type VARCHAR(50) NOT NULL,
        other_user_id UUID,
        group_id UUID,
        channel_id UUID,
        last_message TEXT,
        last_message_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        unread_count INT DEFAULT 0,
        is_archived BOOLEAN DEFAULT false,
        is_pinned BOOLEAN DEFAULT false,
        is_muted BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create requests table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        from_user_id UUID NOT NULL,
        to_user_id UUID NOT NULL,
        message_preview TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create messages table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL,
        sender_id UUID NOT NULL,
        text TEXT NOT NULL,
        is_reply_to UUID,
        reply_preview TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      );
    `);

    // Create channels table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS channels (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        avatar TEXT,
        created_by UUID NOT NULL,
        member_count INT DEFAULT 1,
        is_archived BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create channel_members table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS channel_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        channel_id UUID NOT NULL,
        user_id UUID NOT NULL,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Database initialized');
  } catch (err) {
    console.error('Database initialization error:', err);
  }
}

// Seed staging data
async function seedStagingData() {
  const IS_STAGING = process.env.USERNODE_ENV === 'staging';
  if (!IS_STAGING) return;

  try {
    const demoUserId = '00000000-0000-0000-0000-000000000001';

    // Check if data already seeded
    const existing = await pool.query(
      'SELECT COUNT(*) FROM conversations WHERE user_id = $1',
      [demoUserId]
    );

    if (existing.rows[0].count > 0) return;

    // Seed DM conversations
    const dm1 = await pool.query(`
      INSERT INTO conversations (user_id, conversation_type, other_user_id, last_message, last_message_timestamp, unread_count)
      VALUES ($1, 'direct', $2, 'That sounds great! Let''s meet up soon.', NOW() - INTERVAL '2 minutes', 2)
      RETURNING id
    `, [demoUserId, '00000000-0000-0000-0000-000000000011']);

    const dm2 = await pool.query(`
      INSERT INTO conversations (user_id, conversation_type, other_user_id, last_message, last_message_timestamp, unread_count)
      VALUES ($1, 'direct', $2, 'Did you see the latest updates?', NOW() - INTERVAL '1 hour', 0)
      RETURNING id
    `, [demoUserId, '00000000-0000-0000-0000-000000000012']);

    const dm3 = await pool.query(`
      INSERT INTO conversations (user_id, conversation_type, other_user_id, last_message, last_message_timestamp, unread_count)
      VALUES ($1, 'direct', $2, 'Thanks for the help yesterday!', NOW() - INTERVAL '1 day', 1)
      RETURNING id
    `, [demoUserId, '00000000-0000-0000-0000-000000000013']);

    // Seed group conversations
    const group1 = await pool.query(`
      INSERT INTO conversations (user_id, conversation_type, group_id, last_message, last_message_timestamp, unread_count)
      VALUES ($1, 'group', $2, 'Let''s catch up soon!', NOW() - INTERVAL '5 minutes', 0)
      RETURNING id
    `, [demoUserId, '00000000-0000-0000-0000-000000000021']);

    const group2 = await pool.query(`
      INSERT INTO conversations (user_id, conversation_type, group_id, last_message, last_message_timestamp, unread_count)
      VALUES ($1, 'group', $2, 'Thanks! Reviewing now', NOW() - INTERVAL '25 minutes', 0)
      RETURNING id
    `, [demoUserId, '00000000-0000-0000-0000-000000000022']);

    // Seed requests
    await pool.query(`
      INSERT INTO requests (from_user_id, to_user_id, message_preview, status, created_at)
      VALUES ($1, $2, $3, 'pending', NOW() - INTERVAL '3 hours')
      ON CONFLICT DO NOTHING
    `, [demoUserId, '00000000-0000-0000-0000-000000000031', "Hi, I'd like to connect with you."]);

    await pool.query(`
      INSERT INTO requests (from_user_id, to_user_id, message_preview, status, created_at)
      VALUES ($1, $2, $3, 'pending', NOW() - INTERVAL '1 day')
      ON CONFLICT DO NOTHING
    `, [demoUserId, '00000000-0000-0000-0000-000000000032', "Let's collaborate on something cool!"]);

    console.log('Staging data seeded');
  } catch (err) {
    console.error('Staging seed error:', err);
  }
}

// Start server
const server = app.listen(PORT, async () => {
  console.log(`Server listening on port ${PORT}`);
  await initDatabase();
  await seedStagingData();
});

module.exports = app;
