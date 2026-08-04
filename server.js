const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const PLATFORM_BASE_URL = process.env.PLATFORM_BASE_URL || 'https://social-vibecoding.usernodelabs.org';
const APP_SLUG = process.env.APP_SLUG || 'guardian';
const USERNODE_JWT_PUBLIC_KEY = process.env.USERNODE_JWT_PUBLIC_KEY;
const IS_STAGING = process.env.USERNODE_ENV === 'staging';

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

function decodeUser(req) {
  const token = req.query.token || req.headers['x-usernode-token'];
  if (token && USERNODE_JWT_PUBLIC_KEY) {
    try {
      const payload = jwt.verify(token, USERNODE_JWT_PUBLIC_KEY, {
        algorithms: ['RS256'],
        issuer: 'usernode',
        audience: 'usernode:app:' + process.env.USERNODE_APP_ID
      });
      if (payload.pur === 'iframe') {
        return payload;
      }
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
// NOTE: /api/groups is deliberately NOT listed here. Group membership is
// per-user data, so every group route must run against a verified req.user.
// /api/conversations is deliberately NOT listed here either: conversation
// pin/read/hide state is per-user, so it must run against a verified req.user.
// /api/messages and /api/direct-conversations aren't listed either: message
// history and who a user is DMing are both per-user data.
const PUBLIC_PREFIXES = ['/explorer-api/'];

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
let shuttingDown = false;
app.get('/health', (req, res) => {
  if (shuttingDown) return res.status(503).json({ status: 'shutting_down' });
  res.json({ status: 'ok' });
});

// App state endpoint. Also upserts the caller into the `users` directory table
// so Suggested Users / search have real people to show instead of fixtures.
app.get('/api/state', async (req, res) => {
  if (req.user) {
    try {
      await pool.query(
        `INSERT INTO users (id, username, usernode_pubkey, last_seen_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (id) DO UPDATE SET
           username = EXCLUDED.username,
           usernode_pubkey = EXCLUDED.usernode_pubkey,
           last_seen_at = now()`,
        [req.user.id, req.user.username || req.user.id, req.user.usernode_pubkey || null]
      );
    } catch (err) {
      console.error('[users] upsert on /api/state failed:', err);
    }
    await seedStagingPrimaryDM(req.user);
    await seedStagingOwnedEntities(req.user);
  }
  res.json({ status: 'ok', user: req.user || null });
});

// ---------------------------------------------------------------------------
// Users directory (public: usernames + wallet addresses aren't sensitive)
// ---------------------------------------------------------------------------

function shapeUser(row) {
  return {
    id: row.id,
    username: row.username,
    walletAddress: row.usernode_pubkey || null
  };
}

// GET /api/users/suggested - most-recently-active users, for the New Message /
// Create Group / Add Members "Suggested Users" lists.
app.get('/api/users/suggested', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, usernode_pubkey FROM users
        WHERE id != $1
        ORDER BY last_seen_at DESC
        LIMIT 20`,
      [req.user.id]
    );
    res.json({ users: result.rows.map(shapeUser) });
  } catch (err) {
    console.error('[users] suggested failed:', err);
    res.status(500).json({ error: 'Failed to load suggested users' });
  }
});

// GET /api/users/search?q= - search the directory by username or wallet address.
app.get('/api/users/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) return res.json({ users: [] });

  const likePattern = '%' + q.replace(/[\\%_]/g, (c) => '\\' + c) + '%';
  try {
    const result = await pool.query(
      `SELECT id, username, usernode_pubkey FROM users
        WHERE id != $1
          AND (username ILIKE $2 ESCAPE '\\' OR usernode_pubkey ILIKE $2 ESCAPE '\\')
        ORDER BY last_seen_at DESC
        LIMIT 20`,
      [req.user.id, likePattern]
    );
    res.json({ users: result.rows.map(shapeUser) });
  } catch (err) {
    console.error('[users] search failed:', err);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

const MAX_BIO_LENGTH = 50;

// GET /api/profile - the caller's own profile (bio/avatar are private-ish
// editable fields, so this always reads the caller's own row, never anyone
// else's).
app.get('/api/profile', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, usernode_pubkey, bio, avatar_url, avatar_image_id
         FROM users WHERE id = $1`,
      [req.user.id]
    );
    const row = result.rows[0];
    res.json({
      profile: {
        id: req.user.id,
        username: (row && row.username) || req.user.username || req.user.id,
        bio: (row && row.bio) || '',
        avatarUrl: (row && row.avatar_url) || null,
        avatarImageId: (row && row.avatar_image_id) || null,
        walletAddress: (row && row.usernode_pubkey) || req.user.usernode_pubkey || null
      }
    });
  } catch (err) {
    console.error('[profile] fetch failed:', err);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

// PUT /api/profile - update the caller's own bio and/or avatar. Only the
// uploaded file's URL/id are ever persisted here -- avatar bytes go through
// window.usernode.uploadFile on the client and never pass through this route.
app.put('/api/profile', async (req, res) => {
  const { bio, avatarUrl, avatarImageId } = req.body || {};

  if (typeof bio === 'string' && bio.length > MAX_BIO_LENGTH) {
    return res.status(400).json({ error: `Bio must be ${MAX_BIO_LENGTH} characters or less` });
  }

  const bioVal = typeof bio === 'string' ? bio : null;
  const avatarUrlVal = typeof avatarUrl === 'string' ? avatarUrl : null;
  const avatarImageIdVal = typeof avatarImageId === 'string' ? avatarImageId : null;

  try {
    const result = await pool.query(
      `INSERT INTO users (id, username, usernode_pubkey, bio, avatar_url, avatar_image_id)
       VALUES ($1, $2, $3, COALESCE($4, ''), $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         bio = COALESCE($4, users.bio),
         avatar_url = COALESCE($5, users.avatar_url),
         avatar_image_id = COALESCE($6, users.avatar_image_id)
       RETURNING bio, avatar_url, avatar_image_id`,
      [req.user.id, req.user.username || req.user.id, req.user.usernode_pubkey || null, bioVal, avatarUrlVal, avatarImageIdVal]
    );
    const row = result.rows[0];
    res.json({
      profile: {
        id: req.user.id,
        bio: row.bio || '',
        avatarUrl: row.avatar_url || null,
        avatarImageId: row.avatar_image_id || null
      }
    });
  } catch (err) {
    console.error('[profile] update failed:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ---------------------------------------------------------------------------
// Group helpers
// ---------------------------------------------------------------------------

// Returns the caller's role in a group: 'owner', the stored group_members
// role, or null if the group doesn't exist or the caller isn't a member.
// 'user_self' is this (single-real-user, mostly mock) app's placeholder for
// "whoever is logged in" -- the same sentinel the frontend already uses in
// isCurrentUserGroupAdmin -- so rows seeded against it match whichever real
// user is currently authenticated.
async function getGroupRole(groupId, userId) {
  const groupResult = await pool.query('SELECT creator_user_id FROM groups WHERE id = $1', [groupId]);
  if (groupResult.rows.length === 0) return null;

  const creatorId = groupResult.rows[0].creator_user_id;
  if (creatorId === userId || creatorId === 'user_self') return 'owner';

  const memberResult = await pool.query(
    'SELECT role FROM group_members WHERE group_id = $1 AND (user_id = $2 OR user_id = $3)',
    [groupId, userId, 'user_self']
  );
  return memberResult.rows.length > 0 ? memberResult.rows[0].role : null;
}

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
// anyone. A private group is still fetchable by its exact id (that's what an
// invite link hands a non-member -- possessing the id is the authorization),
// but a non-member only gets a minimal preview shape with no member list, and
// private groups still never appear in the scope=discover listing above.
app.get('/api/groups/:groupId', async (req, res) => {
  try {
    const group = await loadGroupWithMembers(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (group.visibility === 'private') {
      const role = await memberRole(group.id, req.user.id);
      if (!role) {
        return res.json({ group: { ...group, members: [] } });
      }
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

// GET /api/groups/:groupId/join-requests - List pending join requests (owner/admin only)
app.get('/api/groups/:groupId/join-requests', async (req, res) => {
  const { groupId } = req.params;
  try {
    const role = await getGroupRole(groupId, req.user.id);
    if (role === null) return res.status(404).json({ error: 'Group not found' });
    if (role !== 'owner' && role !== 'admin') {
      return res.status(403).json({ error: 'Only owners and admins can view join requests' });
    }
    const result = await pool.query(
      'SELECT user_id, username, requested_at FROM join_requests WHERE group_id = $1 ORDER BY requested_at',
      [groupId]
    );
    res.json({
      joinRequests: result.rows.map((r) => ({
        userId: r.user_id,
        username: r.username,
        requestedAt: new Date(r.requested_at).getTime()
      }))
    });
  } catch (err) {
    console.error('[groups] join requests fetch failed:', err);
    res.status(500).json({ error: 'Failed to load join requests' });
  }
});

// POST /api/groups/:groupId/join-requests - Request to join a private group
app.post('/api/groups/:groupId/join-requests', async (req, res) => {
  const { groupId } = req.params;
  try {
    const groupRes = await pool.query('SELECT visibility FROM groups WHERE id = $1', [groupId]);
    if (groupRes.rowCount === 0) return res.status(404).json({ error: 'Group not found' });
    if (groupRes.rows[0].visibility !== 'private') {
      return res.status(400).json({ error: 'This group does not require a join request' });
    }

    const role = await memberRole(groupId, req.user.id);
    if (role) return res.status(400).json({ error: 'You are already a member of this group' });

    await pool.query(
      `INSERT INTO join_requests (group_id, user_id, username)
       VALUES ($1, $2, $3)
       ON CONFLICT (group_id, user_id) DO NOTHING`,
      [groupId, req.user.id, req.user.username || req.user.id]
    );
    res.json({ id: groupId, message: 'Join request sent' });
  } catch (err) {
    console.error('[groups] join request failed:', err);
    res.status(500).json({ error: 'Failed to send join request' });
  }
});

// POST /api/groups/:groupId/join-requests/:requestId/approve - Approve a join request.
// :requestId is the requester's user id (the client has no separate request-id concept).
app.post('/api/groups/:groupId/join-requests/:requestId/approve', async (req, res) => {
  const { groupId, requestId: userId } = req.params;
  try {
    const role = await getGroupRole(groupId, req.user.id);
    if (role === null) return res.status(404).json({ error: 'Group not found' });
    if (role !== 'owner' && role !== 'admin') {
      return res.status(403).json({ error: 'Only owners and admins can approve join requests' });
    }

    const reqRes = await pool.query(
      'SELECT username FROM join_requests WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );
    if (reqRes.rowCount === 0) return res.status(404).json({ error: 'Join request not found' });

    await pool.query(
      `INSERT INTO group_members (group_id, user_id, username, role, invited_by_user_id)
       VALUES ($1, $2, $3, 'member', NULL)
       ON CONFLICT (group_id, user_id) DO NOTHING`,
      [groupId, userId, reqRes.rows[0].username]
    );
    await pool.query('DELETE FROM join_requests WHERE group_id = $1 AND user_id = $2', [groupId, userId]);

    res.json({ id: groupId, requestId: userId, message: 'Join request approved' });
  } catch (err) {
    console.error('[groups] approve join request failed:', err);
    res.status(500).json({ error: 'Failed to approve join request' });
  }
});

// POST /api/groups/:groupId/join-requests/:requestId/deny - Deny a join request
app.post('/api/groups/:groupId/join-requests/:requestId/deny', async (req, res) => {
  const { groupId, requestId: userId } = req.params;
  try {
    const role = await getGroupRole(groupId, req.user.id);
    if (role === null) return res.status(404).json({ error: 'Group not found' });
    if (role !== 'owner' && role !== 'admin') {
      return res.status(403).json({ error: 'Only owners and admins can deny join requests' });
    }
    await pool.query('DELETE FROM join_requests WHERE group_id = $1 AND user_id = $2', [groupId, userId]);
    res.json({ id: groupId, requestId: userId, message: 'Join request denied' });
  } catch (err) {
    console.error('[groups] deny join request failed:', err);
    res.status(500).json({ error: 'Failed to deny join request' });
  }
});

// ---------------------------------------------------------------------------
// Channel Management API Endpoints
// ---------------------------------------------------------------------------

const MAX_CHANNEL_NAME_LENGTH = 50;
const MAX_CHANNEL_DESCRIPTION_LENGTH = 250;

function generateChannelId() {
  return 'channel_' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
}

// Shape a channel row the way the frontend already consumes channels.
function shapeChannel(row, followerCount, isFollowing) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    avatar: row.avatar || defaultAvatar(row.name),
    creatorId: row.creator_user_id,
    creatorUsername: row.creator_username,
    createdAt: new Date(row.created_at).getTime(),
    followerCount: followerCount !== undefined && followerCount !== null ? Number(followerCount) : 0,
    isFollowing: !!isFollowing,
    isNew: row.is_new === undefined ? undefined : !!row.is_new
  };
}

async function loadChannelWithFollowerCount(channelId, userId) {
  const chRes = await pool.query('SELECT * FROM channels WHERE id = $1', [channelId]);
  if (chRes.rowCount === 0) return null;
  const countRes = await pool.query('SELECT COUNT(*) FROM channel_followers WHERE channel_id = $1', [channelId]);
  let isFollowing = false;
  if (userId) {
    const followRes = await pool.query(
      'SELECT 1 FROM channel_followers WHERE channel_id = $1 AND (user_id = $2 OR user_id = $3)',
      [channelId, userId, 'user_self']
    );
    isFollowing = followRes.rowCount > 0;
  }
  return shapeChannel(chRes.rows[0], countRes.rows[0].count, isFollowing);
}

// GET /api/channels?scope=mine|discover - list the caller's followed/owned
// channels, or channels they don't yet follow (the Discover feed).
app.get('/api/channels', async (req, res) => {
  const scope = req.query.scope === 'discover' ? 'discover' : 'mine';
  try {
    if (scope === 'discover') {
      const result = await pool.query(
        `SELECT c.*,
                (SELECT COUNT(*) FROM channel_followers f WHERE f.channel_id = c.id) AS follower_count,
                (c.created_at > now() - interval '7 days') AS is_new
           FROM channels c
          WHERE c.creator_user_id != $1
            AND c.creator_user_id != 'user_self'
            AND NOT EXISTS (
              SELECT 1 FROM channel_followers f
               WHERE f.channel_id = c.id AND f.user_id = $1
            )
          ORDER BY c.created_at DESC
          LIMIT 100`,
        [req.user.id]
      );
      return res.json({ channels: result.rows.map((row) => shapeChannel(row, row.follower_count, false)) });
    }

    const result = await pool.query(
      `SELECT c.*,
              (SELECT COUNT(*) FROM channel_followers f WHERE f.channel_id = c.id) AS follower_count
         FROM channels c
        WHERE c.creator_user_id = $1
           OR c.creator_user_id = 'user_self'
           OR EXISTS (
                SELECT 1 FROM channel_followers f
                 WHERE f.channel_id = c.id AND f.user_id = $1
              )
        ORDER BY c.created_at DESC
        LIMIT 100`,
      [req.user.id]
    );
    res.json({ channels: result.rows.map((row) => shapeChannel(row, row.follower_count, true)) });
  } catch (err) {
    console.error('[channels] list failed:', err);
    res.status(500).json({ error: 'Failed to load channels' });
  }
});

// GET /api/channels/:channelId - Fetch channel details (all channels are public).
app.get('/api/channels/:channelId', async (req, res) => {
  try {
    const channel = await loadChannelWithFollowerCount(req.params.channelId, req.user.id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    res.json({ channel });
  } catch (err) {
    console.error('[channels] fetch failed:', err);
    res.status(500).json({ error: 'Failed to load channel' });
  }
});

// POST /api/channels - Create a new channel with the creator auto-followed.
app.post('/api/channels', async (req, res) => {
  const { name, description, avatar } = req.body || {};

  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (!trimmedName) {
    return res.status(400).json({ error: 'Channel name is required' });
  }
  if (trimmedName.length > MAX_CHANNEL_NAME_LENGTH) {
    return res.status(400).json({ error: 'Channel name must be 50 characters or less' });
  }

  const trimmedDescription = typeof description === 'string' ? description.trim() : '';
  if (trimmedDescription.length > MAX_CHANNEL_DESCRIPTION_LENGTH) {
    return res.status(400).json({ error: 'Description must be 250 characters or less' });
  }

  const channelId = generateChannelId();
  const avatarValue = typeof avatar === 'string' && avatar ? avatar : defaultAvatar(trimmedName);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO channels (id, name, description, avatar, creator_user_id, creator_username)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [channelId, trimmedName, trimmedDescription, avatarValue, req.user.id, req.user.username || req.user.id]
    );
    await client.query(
      `INSERT INTO channel_followers (channel_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (channel_id, user_id) DO NOTHING`,
      [channelId, req.user.id]
    );
    await client.query('COMMIT');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (rollbackErr) { /* already failed */ }
    console.error('[channels] create failed:', err);
    client.release();
    return res.status(500).json({ error: 'Failed to create channel' });
  }
  client.release();

  try {
    const channel = await loadChannelWithFollowerCount(channelId, req.user.id);
    res.status(201).json({ channel });
  } catch (err) {
    console.error('[channels] create readback failed:', err);
    res.status(500).json({ error: 'Failed to create channel' });
  }
});

// POST /api/channels/:channelId/follow - Follow a channel. Idempotent.
app.post('/api/channels/:channelId/follow', async (req, res) => {
  const { channelId } = req.params;
  try {
    const chRes = await pool.query('SELECT id FROM channels WHERE id = $1', [channelId]);
    if (chRes.rowCount === 0) return res.status(404).json({ error: 'Channel not found' });

    await pool.query(
      `INSERT INTO channel_followers (channel_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (channel_id, user_id) DO NOTHING`,
      [channelId, req.user.id]
    );
    const channel = await loadChannelWithFollowerCount(channelId, req.user.id);
    res.json({ channel });
  } catch (err) {
    console.error('[channels] follow failed:', err);
    res.status(500).json({ error: 'Failed to follow channel' });
  }
});

// DELETE /api/channels/:channelId/follow - Unfollow a channel. Idempotent.
app.delete('/api/channels/:channelId/follow', async (req, res) => {
  const { channelId } = req.params;
  try {
    await pool.query('DELETE FROM channel_followers WHERE channel_id = $1 AND user_id = $2', [channelId, req.user.id]);
    const channel = await loadChannelWithFollowerCount(channelId, req.user.id);
    res.json({ channel });
  } catch (err) {
    console.error('[channels] unfollow failed:', err);
    res.status(500).json({ error: 'Failed to unfollow channel' });
  }
});

// DELETE /api/channels/:channelId - Delete a channel (owner only)
app.delete('/api/channels/:channelId', async (req, res) => {
  const { channelId } = req.params;
  try {
    const role = await getChannelRole(channelId, req.user.id);
    if (role === null) return res.status(404).json({ error: 'Channel not found' });
    if (role !== 'owner') {
      return res.status(403).json({ error: 'Only the channel creator can delete this channel' });
    }
    await pool.query('DELETE FROM channels WHERE id = $1', [channelId]);
    res.json({ id: channelId, message: 'Channel deleted' });
  } catch (err) {
    console.error('[channels] delete failed:', err);
    res.status(500).json({ error: 'Failed to delete channel' });
  }
});

// Conversation Management API Endpoints

// GET /api/conversations/state - Bulk read-back of the caller's own view
// state (pin, manually-marked-unread, hidden-from-inbox) for every
// conversation they have an override for, keyed by the client-synthesized
// conversation id. Called once at boot so pin/unread state set via the PUT
// below survives a reload instead of resetting to the client-side defaults.
app.get('/api/conversations/state', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const result = await pool.query(
      `SELECT conversation_id, pinned, manually_marked_unread, hidden_from_inbox
       FROM conversation_user_state WHERE user_id = $1`,
      [req.user.id]
    );
    const states = {};
    for (const row of result.rows) {
      states[row.conversation_id] = {
        pinned: row.pinned,
        manuallyMarkedUnread: row.manually_marked_unread,
        hiddenFromInbox: row.hidden_from_inbox
      };
    }
    res.json({ states });
  } catch (err) {
    console.error('[conversations] state fetch failed:', err);
    res.status(500).json({ error: 'Failed to fetch conversation state' });
  }
});

// PUT /api/conversations/:id/state - Update the caller's own view of a
// conversation: pin, manually-marked-unread, or hidden-from-inbox (the local
// "delete" for a DM; group/channel deletes are a leave/unfollow instead).
// Per-user data, so this route requires a verified req.user (see
// PUBLIC_PREFIXES above). Each field is optional so callers can toggle one
// flag at a time without clobbering the others.
app.put('/api/conversations/:id/state', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

  const { id } = req.params;
  const { pinned, manuallyMarkedUnread, hiddenFromInbox } = req.body || {};
  const pinnedVal = typeof pinned === 'boolean' ? pinned : null;
  const unreadVal = typeof manuallyMarkedUnread === 'boolean' ? manuallyMarkedUnread : null;
  const hiddenVal = typeof hiddenFromInbox === 'boolean' ? hiddenFromInbox : null;

  try {
    const result = await pool.query(
      `INSERT INTO conversation_user_state
         (conversation_id, user_id, pinned, manually_marked_unread, hidden_from_inbox)
       VALUES ($1, $2, COALESCE($3, false), COALESCE($4, false), COALESCE($5, false))
       ON CONFLICT (conversation_id, user_id) DO UPDATE SET
         pinned = COALESCE($3, conversation_user_state.pinned),
         manually_marked_unread = COALESCE($4, conversation_user_state.manually_marked_unread),
         hidden_from_inbox = COALESCE($5, conversation_user_state.hidden_from_inbox),
         updated_at = now()
       RETURNING pinned, manually_marked_unread, hidden_from_inbox`,
      [id, req.user.id, pinnedVal, unreadVal, hiddenVal]
    );
    const row = result.rows[0];
    res.json({
      id,
      pinned: row.pinned,
      manuallyMarkedUnread: row.manually_marked_unread,
      hiddenFromInbox: row.hidden_from_inbox,
      message: 'Conversation state updated'
    });
  } catch (err) {
    console.error('[conversations] state update failed:', err);
    res.status(500).json({ error: 'Failed to update conversation state' });
  }
});

// ---------------------------------------------------------------------------
// Messaging (DM / group / channel) helpers
// ---------------------------------------------------------------------------

// Canonical id for a real (non-mock) direct conversation between two real
// users: the two user ids sorted, so either participant resolves to the same
// row regardless of who "started" it. This is the fix for the DM half of the
// message-delivery bug -- the frontend's `conv_<peerId>` id is a per-browser
// construct, not a shared identity, so persistence has to be keyed on
// something both sides agree on.
async function getOrCreateDirectConversation(userIdA, userIdB) {
  const [a, b] = [userIdA, userIdB].sort();
  const existing = await pool.query(
    'SELECT id FROM direct_conversations WHERE user_id_a = $1 AND user_id_b = $2',
    [a, b]
  );
  if (existing.rowCount > 0) return existing.rows[0].id;

  const id = 'dm_' + crypto.randomBytes(12).toString('hex');
  await pool.query(
    `INSERT INTO direct_conversations (id, user_id_a, user_id_b)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id_a, user_id_b) DO NOTHING`,
    [id, a, b]
  );
  const row = await pool.query(
    'SELECT id FROM direct_conversations WHERE user_id_a = $1 AND user_id_b = $2',
    [a, b]
  );
  return row.rows[0].id;
}

// Same OR-match sentinel pattern as getGroupRole above: a channel seeded with
// creator_user_id 'user_self' is "owned" by whichever real user is currently
// logged in, matching the frontend's channels fixture semantics exactly.
async function getChannelRole(channelId, userId) {
  const chResult = await pool.query('SELECT creator_user_id FROM channels WHERE id = $1', [channelId]);
  if (chResult.rows.length === 0) return null;
  return (chResult.rows[0].creator_user_id === userId || chResult.rows[0].creator_user_id === 'user_self')
    ? 'owner'
    : 'follower';
}

function shapeMessage(row) {
  const msg = {
    id: row.id,
    senderId: row.sender_user_id,
    senderName: row.sender_username,
    text: row.text || '',
    timestamp: new Date(row.created_at).getTime()
  };
  if (row.image_url) {
    msg.imageUrl = row.image_url;
    msg.imageId = row.image_id;
  }
  if (row.reply_to_message_id) {
    msg.replyToMessageId = row.reply_to_message_id;
    msg.replyToSenderName = row.reply_to_sender_name;
    msg.replyToPreviewText = row.reply_to_preview_text;
  }
  return msg;
}

const MAX_MESSAGE_TEXT_LENGTH = 4000;

// Shared insert, used by all three surfaces. The message id is client-chosen
// (the same id the sender is already rendering optimistically) so a retry --
// or the sender's own next poll -- is naturally idempotent instead of
// creating a duplicate bubble.
async function insertMessage(conversationType, conversationId, sender, body) {
  const id = typeof (body && body.id) === 'string' && body.id.trim()
    ? body.id.trim().slice(0, 100)
    : `msg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const text = typeof (body && body.text) === 'string' ? body.text.slice(0, MAX_MESSAGE_TEXT_LENGTH) : '';
  const imageUrl = typeof (body && body.imageUrl) === 'string' ? body.imageUrl : null;
  const imageId = typeof (body && body.imageId) === 'string' ? body.imageId : null;
  const replyTo = body && body.replyTo && typeof body.replyTo === 'object' ? body.replyTo : null;

  await pool.query(
    `INSERT INTO messages
       (id, conversation_type, conversation_id, sender_user_id, sender_username,
        text, image_url, image_id, reply_to_message_id, reply_to_sender_name, reply_to_preview_text)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (id) DO NOTHING`,
    [
      id, conversationType, conversationId, sender.id, sender.username || sender.id,
      text, imageUrl, imageId,
      replyTo ? String(replyTo.messageId || '').slice(0, 100) || null : null,
      replyTo ? String(replyTo.senderName || '').slice(0, 80) : null,
      replyTo ? String(replyTo.previewText || '').slice(0, 200) : null
    ]
  );
  const row = await pool.query('SELECT * FROM messages WHERE id = $1', [id]);
  return shapeMessage(row.rows[0]);
}

async function listMessages(conversationType, conversationId) {
  const result = await pool.query(
    `SELECT * FROM messages WHERE conversation_type = $1 AND conversation_id = $2
      ORDER BY created_at ASC LIMIT 500`,
    [conversationType, conversationId]
  );
  return result.rows.map(shapeMessage);
}

// ---------------------------------------------------------------------------
// Messaging API Endpoints
// ---------------------------------------------------------------------------

// GET /api/direct-conversations - list the caller's real DM conversations
// (peer identity + last message), so the inbox survives a reload instead of
// only ever existing in that tab's in-memory `conversations` array.
app.get('/api/direct-conversations', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT dc.id, dc.user_id_a, dc.user_id_b,
              u.username AS peer_username, u.usernode_pubkey AS peer_pubkey,
              lm.text AS last_text, lm.sender_user_id AS last_sender_id, lm.created_at AS last_at
         FROM direct_conversations dc
         JOIN users u ON u.id = (CASE WHEN dc.user_id_a = $1 THEN dc.user_id_b ELSE dc.user_id_a END)
         LEFT JOIN LATERAL (
           SELECT text, sender_user_id, created_at FROM messages
            WHERE conversation_type = 'direct' AND conversation_id = dc.id
            ORDER BY created_at DESC LIMIT 1
         ) lm ON true
        WHERE dc.user_id_a = $1 OR dc.user_id_b = $1
        ORDER BY COALESCE(lm.created_at, dc.created_at) DESC`,
      [req.user.id]
    );
    res.json({
      conversations: result.rows.map((row) => ({
        peerId: row.user_id_a === req.user.id ? row.user_id_b : row.user_id_a,
        peerUsername: row.peer_username,
        peerWalletAddress: row.peer_pubkey || null,
        lastMessage: row.last_text || null,
        lastMessageSenderId: row.last_sender_id || null,
        lastMessageAt: row.last_at ? new Date(row.last_at).getTime() : null
      }))
    });
  } catch (err) {
    console.error('[messages] direct-conversations list failed:', err);
    res.status(500).json({ error: 'Failed to load conversations' });
  }
});

// GET /api/messages/direct/:peerId - full history of the caller's DM thread
// with peerId. Scoped by construction: the conversation row is looked up (or
// simply doesn't exist yet) for req.user + peerId, so there's no conversation
// id a caller could pass to read someone else's thread.
app.get('/api/messages/direct/:peerId', async (req, res) => {
  try {
    const [a, b] = [req.user.id, req.params.peerId].sort();
    const convRes = await pool.query(
      'SELECT id FROM direct_conversations WHERE user_id_a = $1 AND user_id_b = $2',
      [a, b]
    );
    if (convRes.rowCount === 0) return res.json({ messages: [] });
    res.json({ messages: await listMessages('direct', convRes.rows[0].id) });
  } catch (err) {
    console.error('[messages] direct fetch failed:', err);
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

// POST /api/messages/direct/:peerId - send a DM. Any authenticated user can
// message any other; the conversation row is created on first send.
app.post('/api/messages/direct/:peerId', async (req, res) => {
  const peerId = req.params.peerId;
  if (peerId === req.user.id) return res.status(400).json({ error: "Can't message yourself" });
  try {
    const conversationId = await getOrCreateDirectConversation(req.user.id, peerId);
    const message = await insertMessage('direct', conversationId, req.user, req.body);
    res.status(201).json({ message });
  } catch (err) {
    console.error('[messages] direct send failed:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// GET /api/messages/group/:groupId - only members can read a group's history.
app.get('/api/messages/group/:groupId', async (req, res) => {
  try {
    const role = await getGroupRole(req.params.groupId, req.user.id);
    if (role === null) return res.status(404).json({ error: 'Group not found' });
    res.json({ messages: await listMessages('group', req.params.groupId) });
  } catch (err) {
    console.error('[messages] group fetch failed:', err);
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

// POST /api/messages/group/:groupId - any member can post (owners/admins are
// not special here, matching the composer already being shown to every
// member in renderGroupConversationPage).
app.post('/api/messages/group/:groupId', async (req, res) => {
  try {
    const role = await getGroupRole(req.params.groupId, req.user.id);
    if (role === null) return res.status(404).json({ error: 'Group not found' });
    const message = await insertMessage('group', req.params.groupId, req.user, req.body);
    res.status(201).json({ message });
  } catch (err) {
    console.error('[messages] group send failed:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// GET /api/messages/channel/:channelId - channel posts are broadcast content;
// any authenticated user can read them (matches renderChannelView showing the
// feed to owners, followers and Discover previews alike).
app.get('/api/messages/channel/:channelId', async (req, res) => {
  try {
    const role = await getChannelRole(req.params.channelId, req.user.id);
    if (role === null) return res.status(404).json({ error: 'Channel not found' });
    res.json({ messages: await listMessages('channel', req.params.channelId) });
  } catch (err) {
    console.error('[messages] channel fetch failed:', err);
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

// POST /api/messages/channel/:channelId - owner only, matching publishPost's
// existing `channel.creatorId !== 'user_self'` guard on the client.
app.post('/api/messages/channel/:channelId', async (req, res) => {
  try {
    const role = await getChannelRole(req.params.channelId, req.user.id);
    if (role === null) return res.status(404).json({ error: 'Channel not found' });
    if (role !== 'owner') return res.status(403).json({ error: 'Only the channel owner can post' });
    const message = await insertMessage('channel', req.params.channelId, req.user, req.body);
    res.status(201).json({ message });
  } catch (err) {
    console.error('[messages] channel send failed:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
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
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    // Public: a directory of who has opened the app, upserted from every
    // /api/state call. Usernames and wallet addresses aren't sensitive, so
    // staging gets a full copy (unlike the group tables below) and this powers
    // Suggested Users + wallet/username search.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        usernode_pubkey TEXT,
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT NOT NULL DEFAULT ''`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_image_id TEXT`);

    await pool.query(
      `CREATE INDEX IF NOT EXISTS users_last_seen_idx ON users (last_seen_at DESC)`
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS users_username_idx ON users (lower(username))`
    );

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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS direct_conversations (
        id TEXT PRIMARY KEY,
        user_id_a TEXT NOT NULL,
        user_id_b TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (user_id_a, user_id_b)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS channels (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        avatar TEXT NOT NULL DEFAULT '',
        creator_user_id TEXT NOT NULL,
        creator_username TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS channel_followers (
        channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        followed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (channel_id, user_id)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS join_requests (
        id BIGSERIAL PRIMARY KEY,
        group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (group_id, user_id)
      );
    `);

    // The single message store for all three surfaces (DM/group/channel),
    // discriminated by (conversation_type, conversation_id). This is the
    // table that never existed before -- sent messages only ever lived in
    // each browser's in-memory JS array, so nothing was ever delivered to
    // another user or survived a reload.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_type TEXT NOT NULL CHECK (conversation_type IN ('direct', 'group', 'channel')),
        conversation_id TEXT NOT NULL,
        sender_user_id TEXT NOT NULL,
        sender_username TEXT NOT NULL,
        text TEXT NOT NULL DEFAULT '',
        image_url TEXT,
        image_id TEXT,
        reply_to_message_id TEXT,
        reply_to_sender_name TEXT,
        reply_to_preview_text TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await pool.query(
      `CREATE INDEX IF NOT EXISTS messages_conversation_idx
         ON messages (conversation_type, conversation_id, created_at)`
    );

    await pool.query(`
      CREATE TABLE IF NOT EXISTS conversation_user_state (
        conversation_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        pinned BOOLEAN NOT NULL DEFAULT false,
        manually_marked_unread BOOLEAN NOT NULL DEFAULT false,
        hidden_from_inbox BOOLEAN NOT NULL DEFAULT false,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (conversation_id, user_id)
      );
    `);

    await pool.query(
      `CREATE INDEX IF NOT EXISTS conversation_user_state_user_idx
         ON conversation_user_state (user_id)`
    );

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
    // Private: a hidden_from_inbox/pinned row ties a real user_id to a
    // specific conversation_id, which can reveal who a user is DMing.
    await pool.query(`COMMENT ON TABLE conversation_user_state IS 'staging:private'`);
    // Private: reveals who is DMing whom, and the DM content itself.
    await pool.query(`COMMENT ON TABLE direct_conversations IS 'staging:private'`);
    await pool.query(`COMMENT ON TABLE messages IS 'staging:private'`);
    // Private: mirrors the groups table -- channel identity/membership is
    // treated the same way even though the demo channels themselves are
    // reseeded unconditionally below (matching the fixtures already shipped
    // to every client regardless of environment).
    await pool.query(`COMMENT ON TABLE channels IS 'staging:private'`);
    await pool.query(`COMMENT ON TABLE channel_followers IS 'staging:private'`);
    // Private: ties a real user_id to which private group they've asked to join.
    await pool.query(`COMMENT ON TABLE join_requests IS 'staging:private'`);

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

  const channelSeeds = [
    {
      id: 'channel_staging_1',
      name: 'Staging Demo Announcements',
      description: 'Staging demo channel — public announcements feed.',
      avatar: 'SA',
      owner: { id: 'staging-demo-user-1', username: 'staging-demo-owner' },
      followers: [
        { id: 'staging-demo-user-2', username: 'staging-demo-ana' },
        { id: 'staging-demo-user-3', username: 'staging-demo-budi' }
      ]
    },
    {
      id: 'channel_staging_2',
      name: 'Staging Demo Builders',
      description: 'Staging demo channel — a second channel for the Discover list.',
      avatar: 'SB',
      owner: { id: 'staging-demo-user-4', username: 'staging-demo-citra' },
      followers: [{ id: 'staging-demo-user-2', username: 'staging-demo-ana' }]
    }
  ];

  try {
    for (const seed of channelSeeds) {
      await pool.query(
        `INSERT INTO channels (id, name, description, avatar, creator_user_id, creator_username)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [seed.id, seed.name, seed.description, seed.avatar, seed.owner.id, seed.owner.username]
      );
      await pool.query(
        `INSERT INTO channel_followers (channel_id, user_id) VALUES ($1, $2)
         ON CONFLICT (channel_id, user_id) DO NOTHING`,
        [seed.id, seed.owner.id]
      );
      for (const follower of seed.followers) {
        await pool.query(
          `INSERT INTO channel_followers (channel_id, user_id) VALUES ($1, $2)
           ON CONFLICT (channel_id, user_id) DO NOTHING`,
          [seed.id, follower.id]
        );
      }
    }
    console.log('Staging demo channels seeded');
  } catch (err) {
    console.error('Staging channel seed error:', err);
  }

  // A pending join request against the private staging group, from a
  // staging-demo user who isn't already a member -- gives the Join Requests
  // page something real to approve/deny in staging.
  try {
    await pool.query(
      `INSERT INTO join_requests (group_id, user_id, username)
       VALUES ($1, $2, $3)
       ON CONFLICT (group_id, user_id) DO NOTHING`,
      ['group_staging_private_1', 'staging-demo-user-3', 'staging-demo-budi']
    );
    console.log('Staging demo join request seeded');
  } catch (err) {
    console.error('Staging join request seed error:', err);
  }

  // Real, persisted thread history for the staging groups/channels above --
  // idempotent via insertMessage's fixed ids, so this is safe to re-run.
  try {
    const owner = { id: 'staging-demo-user-1', username: 'staging-demo-owner' };
    const ana = { id: 'staging-demo-user-2', username: 'staging-demo-ana' };
    const budi = { id: 'staging-demo-user-3', username: 'staging-demo-budi' };
    const citra = { id: 'staging-demo-user-4', username: 'staging-demo-citra' };

    await insertMessage('group', 'group_staging_public_1', owner, { id: 'msg_staging_gp1_1', text: 'Welcome to the staging demo public group!' });
    await insertMessage('group', 'group_staging_public_1', ana, { id: 'msg_staging_gp1_2', text: 'Glad to be here 👋' });
    await insertMessage('group', 'group_staging_public_1', budi, {
      id: 'msg_staging_gp1_3', text: 'Staging demo photo',
      imageUrl: 'https://picsum.photos/seed/staging-demo-group/400/300', imageId: 'staging-demo-image-group'
    });

    await insertMessage('group', 'group_staging_public_2', ana, { id: 'msg_staging_gp2_1', text: 'This is the second staging demo group.' });
    await insertMessage('group', 'group_staging_public_2', budi, { id: 'msg_staging_gp2_2', text: 'Nice, another one to try Discover with.' });

    await insertMessage('group', 'group_staging_private_1', owner, { id: 'msg_staging_gpr1_1', text: 'This is the private staging demo group.' });
    await insertMessage('group', 'group_staging_private_1', ana, { id: 'msg_staging_gpr1_2', text: 'Thanks for the invite!' });

    await insertMessage('channel', 'channel_staging_1', owner, { id: 'msg_staging_ch1_1', text: 'Welcome to the staging demo announcements channel.' });
    await insertMessage('channel', 'channel_staging_1', owner, {
      id: 'msg_staging_ch1_2', text: 'Staging demo photo',
      imageUrl: 'https://picsum.photos/seed/staging-demo-channel/400/300', imageId: 'staging-demo-image-channel'
    });
    await insertMessage('channel', 'channel_staging_2', citra, { id: 'msg_staging_ch2_1', text: 'First staging demo builder update.' });

    console.log('Staging demo message history seeded');
  } catch (err) {
    console.error('Staging message seed error:', err);
  }

  await seedStagingUsers();
}

// Staging-only, idempotent seed of a real, persisted long DM thread between
// the caller and the staging-demo peer, used for DM preview/scroll tests.
// Called from GET /api/state so it always has a real authenticated user to
// seed the "other side" of the conversation against.
//
// Uses a FIXED conversation id ('dm_staging_primary') rather than
// getOrCreateDirectConversation's random id, because dapp.json test paths are
// static strings and can't reference a per-user-pair generated id. Like
// seedStagingOwnedEntities, this re-points the row to whoever is currently
// authenticated on every call -- if the (user_id_a, user_id_b) pair on file
// doesn't match the current caller + peer, any prior row/messages for either
// the fixed id or that pair are cleared and recreated. Staging-only
// convenience data, safe to reset when "whoever is testing" changes.
async function seedStagingPrimaryDM(currentUser) {
  if (!IS_STAGING || !currentUser) return;
  const peer = { id: 'staging-demo-user-6', username: 'staging-demo-eka' };
  const conversationId = 'dm_staging_primary';
  const [a, b] = [currentUser.id, peer.id].sort();

  try {
    const existing = await pool.query(
      'SELECT user_id_a, user_id_b FROM direct_conversations WHERE id = $1',
      [conversationId]
    );
    const alreadyCorrect = existing.rowCount > 0 &&
      existing.rows[0].user_id_a === a && existing.rows[0].user_id_b === b;

    if (!alreadyCorrect) {
      await pool.query(
        `DELETE FROM messages WHERE conversation_type = 'direct' AND conversation_id IN (
           SELECT id FROM direct_conversations WHERE id = $1 OR (user_id_a = $2 AND user_id_b = $3)
         )`,
        [conversationId, a, b]
      );
      await pool.query(
        'DELETE FROM direct_conversations WHERE id = $1 OR (user_id_a = $2 AND user_id_b = $3)',
        [conversationId, a, b]
      );
      await pool.query(
        'INSERT INTO direct_conversations (id, user_id_a, user_id_b) VALUES ($1, $2, $3)',
        [conversationId, a, b]
      );
    }

    const hasMessages = await pool.query(
      `SELECT 1 FROM messages WHERE conversation_type = 'direct' AND conversation_id = $1 LIMIT 1`,
      [conversationId]
    );
    if (hasMessages.rowCount === 0) {
      const me = { id: currentUser.id, username: currentUser.username || currentUser.id };
      const script = [
        { from: peer, text: 'Hey! Welcome to the staging environment 👋' },
        { from: me, text: 'Thanks! Just checking things out.' },
        { from: peer, text: 'Let me know if anything looks off — notes are at https://example.com/staging-notes.' },
        { from: me, text: 'Will do — this thread is a good test case.' },
        { from: peer, text: 'Exactly, gives the scroll and unread-state tests something real to work with.' },
        { from: me, text: 'Makes sense.' },
        { from: peer, text: 'Ping me anytime.' },
        { from: me, text: 'Appreciate it!' },
        {
          from: peer, text: 'Staging demo photo',
          imageUrl: 'https://picsum.photos/seed/staging-demo-dm/400/300', imageId: 'staging-demo-image-dm'
        }
      ];
      for (let i = 0; i < script.length; i++) {
        const entry = script[i];
        await insertMessage('direct', conversationId, entry.from, {
          id: `msg_staging_dm_${conversationId}_${i + 1}`,
          text: entry.text,
          imageUrl: entry.imageUrl,
          imageId: entry.imageId
        });
      }
    }
  } catch (err) {
    console.error('Staging primary DM seed error:', err);
  }
}

// Staging-only, idempotent seed that gives whoever is CURRENTLY testing in
// staging one group and one channel they actually own. Every other seed above
// is fixed to the staging-demo-* accounts, which the real, currently
// authenticated test user never is — so owner-only UI (managed-groups list,
// admin toggle, Add Admins, Edit/Delete Post) would otherwise have nothing
// real to exercise. Uses fixed ids and re-points ownership to the caller on
// every call, since dapp.json paths are static strings and can't reference a
// per-user id — this is a single-tester fixture, not a multi-user table.
async function seedStagingOwnedEntities(currentUser) {
  if (!IS_STAGING || !currentUser) return;
  const me = { id: currentUser.id, username: currentUser.username || currentUser.id };
  const helper = { id: 'staging-demo-user-2', username: 'staging-demo-ana' };
  const groupId = 'group_staging_owned_1';
  const channelId = 'channel_staging_owned_1';

  try {
    await pool.query(
      `INSERT INTO groups (id, name, description, avatar, visibility, creator_user_id, creator_username)
       VALUES ($1, 'Staging Demo Owned Group', 'Staging demo group — owned by whoever is currently testing, for owner-only UI checks.', 'SO', 'public', $2, $3)
       ON CONFLICT (id) DO UPDATE SET creator_user_id = EXCLUDED.creator_user_id, creator_username = EXCLUDED.creator_username`,
      [groupId, me.id, me.username]
    );
    await pool.query(
      `INSERT INTO group_members (group_id, user_id, username, role, invited_by_user_id)
       VALUES ($1, $2, $3, 'owner', NULL)
       ON CONFLICT (group_id, user_id) DO UPDATE SET role = 'owner', username = EXCLUDED.username`,
      [groupId, me.id, me.username]
    );
    await pool.query(
      `INSERT INTO group_members (group_id, user_id, username, role, invited_by_user_id)
       VALUES ($1, $2, $3, 'member', $4)
       ON CONFLICT (group_id, user_id) DO NOTHING`,
      [groupId, helper.id, helper.username, me.id]
    );
    const groupHasMessages = await pool.query(
      `SELECT 1 FROM messages WHERE conversation_type = 'group' AND conversation_id = $1 LIMIT 1`,
      [groupId]
    );
    if (groupHasMessages.rowCount === 0) {
      await insertMessage('group', groupId, me, { id: `msg_${groupId}_1`, text: 'This group is owned by you, for testing owner-only actions.' });
      await insertMessage('group', groupId, helper, {
        id: `msg_${groupId}_2`, text: 'Staging demo photo',
        imageUrl: 'https://picsum.photos/seed/staging-demo-owned-group/400/300', imageId: 'staging-demo-image-owned-group'
      });
    }

    await pool.query(
      `INSERT INTO channels (id, name, description, avatar, creator_user_id, creator_username)
       VALUES ($1, 'Staging Demo Owned Channel', 'Staging demo channel — owned by whoever is currently testing, for owner-only UI checks.', 'SC', $2, $3)
       ON CONFLICT (id) DO UPDATE SET creator_user_id = EXCLUDED.creator_user_id, creator_username = EXCLUDED.creator_username`,
      [channelId, me.id, me.username]
    );
    await pool.query(
      `INSERT INTO channel_followers (channel_id, user_id) VALUES ($1, $2)
       ON CONFLICT (channel_id, user_id) DO NOTHING`,
      [channelId, me.id]
    );
    await pool.query(
      `INSERT INTO channel_followers (channel_id, user_id) VALUES ($1, $2)
       ON CONFLICT (channel_id, user_id) DO NOTHING`,
      [channelId, helper.id]
    );
    const channelHasMessages = await pool.query(
      `SELECT 1 FROM messages WHERE conversation_type = 'channel' AND conversation_id = $1 LIMIT 1`,
      [channelId]
    );
    if (channelHasMessages.rowCount === 0) {
      await insertMessage('channel', channelId, me, { id: `msg_${channelId}_1`, text: 'This channel is owned by you, for testing owner-only actions.' });
    }

    // Pin/unread state is per-user real data (conversation_user_state), keyed
    // by the CLIENT-synthesized conversation id and the real caller's own id
    // -- so unlike the fixed group/channel ids above, this needs no
    // re-pointing: user_id already IS whoever is currently testing.
    await pool.query(
      `INSERT INTO conversation_user_state (conversation_id, user_id, pinned)
       VALUES ($1, $2, true)
       ON CONFLICT (conversation_id, user_id) DO UPDATE SET pinned = true`,
      [`conv_${groupId}`, me.id]
    );
    await pool.query(
      `INSERT INTO conversation_user_state (conversation_id, user_id, manually_marked_unread)
       VALUES ($1, $2, true)
       ON CONFLICT (conversation_id, user_id) DO UPDATE SET manually_marked_unread = true`,
      ['conv_staging-demo-user-6', me.id]
    );
  } catch (err) {
    console.error('Staging owned entities seed error:', err);
  }
}

// Staging seed for the `users` directory table. `users` is public (full copy
// in staging), but a fresh staging database still starts empty until real
// people open the app, so Suggested Users/search would otherwise be blank.
// One row is given a null wallet address on purpose, so the "no wallet
// linked" rendering path stays exercised in staging too.
async function seedStagingUsers() {
  if (!IS_STAGING) return;

  const seeds = [
    { id: 'staging-demo-user-4', username: 'staging-demo-citra', pubkey: '0x1f3a9c2e7b5d44680a9f0c1e2d3b4a5968f7e6d5', offset: '5 minutes' },
    { id: 'staging-demo-user-5', username: 'staging-demo-dedi', pubkey: '0x8b2e4f6a1c9d3e5b7a0f2c4e6d8b9a1f3e5c7d09', offset: '2 hours' },
    { id: 'staging-demo-user-6', username: 'staging-demo-eka', pubkey: null, offset: '1 day' },
    { id: 'staging-demo-user-7', username: 'staging-demo-fajar', pubkey: '0x4c7d9e1b3a5f60820c4e6a8f0b2d4e6c8a0f2e4d', offset: '3 days' },
    { id: 'staging-demo-user-8', username: 'staging-demo-gita', pubkey: '0x9e1c3a5b7d9f02460a8c0e2f4b6d8a0c2e4f6a8b', offset: '10 days' },
    { id: 'staging-demo-user-9', username: 'staging-demo-hasan', pubkey: '0x2a4c6e8b0d1f35970b9d1f3e5a7c9b1d3f5a7c9e', offset: '30 days' }
  ];

  try {
    for (const seed of seeds) {
      await pool.query(
        `INSERT INTO users (id, username, usernode_pubkey, last_seen_at)
         VALUES ($1, $2, $3, now() - $4::interval)
         ON CONFLICT (id) DO NOTHING`,
        [seed.id, seed.username, seed.pubkey, seed.offset]
      );
    }
    console.log('Staging demo users seeded');
  } catch (err) {
    console.error('Staging user seed error:', err);
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
