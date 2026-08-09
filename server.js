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
// Rotates on every process start (i.e. every deploy). Lets already-open
// clients detect that a newer bundle has shipped and prompt a reload —
// see the /api/state serverVersion field below.
const SERVER_BOOT_ID = Date.now().toString(36) + '-' + crypto.randomBytes(4).toString('hex');

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
        // The platform doesn't guarantee the `id` claim's JSON type -- normalize
        // to a string so it always matches the TEXT id columns it's compared
        // against/stored into downstream (e.g. groups.creator_user_id).
        if (payload.id !== undefined && payload.id !== null) {
          payload.id = String(payload.id);
        }
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

// /app.js and /styles.css always revalidate (no-cache) so an open tab can't
// keep running a stale, pre-deploy bundle from the browser's HTTP cache.
// ETag/Last-Modified are untouched, so an unchanged file still gets a 304.
app.use(express.static('public', {
  setHeaders: (res, path) => {
    if (path.endsWith('/app.js') || path.endsWith('/styles.css')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));

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
    await seedStagingOwnedEntities(req.user);
  }
  res.json({ status: 'ok', user: req.user || null, serverVersion: SERVER_BOOT_ID });
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
    role: m.role,
    avatarUrl: m.avatar_url || null
  }));
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    avatar: row.avatar || defaultAvatar(row.name),
    avatarUrl: row.avatar_url || null,
    avatarImageId: row.avatar_image_id || null,
    visibility: row.visibility,
    creatorId: row.creator_user_id,
    creatorUsername: row.creator_username,
    createdAt: new Date(row.created_at).getTime(),
    memberCount: row.member_count !== undefined && row.member_count !== null
      ? Number(row.member_count)
      : members.length,
    members,
    isNew: row.is_new === undefined ? undefined : !!row.is_new,
    lastMessage: row.last_text !== undefined ? (row.last_text || null) : undefined,
    lastMessageSenderUsername: row.last_sender_username || null,
    lastMessageAt: row.last_at ? new Date(row.last_at).getTime() : null,
    unreadCount: row.unread_count !== undefined && row.unread_count !== null ? Number(row.unread_count) : undefined
  };
}

async function loadGroupWithMembers(groupId) {
  const groupRes = await pool.query('SELECT * FROM groups WHERE id = $1', [groupId]);
  if (groupRes.rowCount === 0) return null;
  const memberRes = await pool.query(
    `SELECT gm.user_id, gm.username, gm.role, u.avatar_url FROM group_members gm
      LEFT JOIN users u ON u.id = gm.user_id
      WHERE gm.group_id = $1
      ORDER BY CASE gm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, gm.joined_at`,
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
              (SELECT COUNT(*) FROM group_members m WHERE m.group_id = g.id) AS member_count,
              lm.text AS last_text, lm.sender_username AS last_sender_username, lm.created_at AS last_at,
              COALESCE(unread.count, 0) AS unread_count
         FROM groups g
         LEFT JOIN LATERAL (
           SELECT text, sender_username, created_at FROM messages
            WHERE conversation_type = 'group' AND conversation_id = g.id
            ORDER BY created_at DESC LIMIT 1
         ) lm ON true
         LEFT JOIN conversation_user_state cus
           ON cus.conversation_id = 'conv_' || g.id AND cus.user_id = $1
         LEFT JOIN LATERAL (
           SELECT count(*)::int AS count FROM messages
            WHERE conversation_type = 'group' AND conversation_id = g.id
              AND sender_user_id != $1
              AND cus.last_read_at IS NOT NULL
              AND created_at > cus.last_read_at
         ) unread ON true
        WHERE EXISTS (
                SELECT 1 FROM group_members m
                 WHERE m.group_id = g.id AND m.user_id = $1
              )
        ORDER BY COALESCE(lm.created_at, g.created_at) DESC
        LIMIT 100`,
      [req.user.id]
    );
    if (result.rowCount === 0) return res.json({ groups: [] });

    const ids = result.rows.map((r) => r.id);
    const memberRes = await pool.query(
      `SELECT gm.group_id, gm.user_id, gm.username, gm.role, u.avatar_url FROM group_members gm
        LEFT JOIN users u ON u.id = gm.user_id
        WHERE gm.group_id = ANY($1::text[])
        ORDER BY CASE gm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, gm.joined_at`,
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
  const { name, description, avatar, avatarUrl, avatarImageId, visibility } = req.body || {};

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
  const avatarUrlValue = typeof avatarUrl === 'string' && avatarUrl ? avatarUrl : null;
  const avatarImageIdValue = typeof avatarImageId === 'string' && avatarImageId ? avatarImageId : null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO groups (id, name, description, avatar, avatar_url, avatar_image_id, visibility, creator_user_id, creator_username)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        groupId,
        trimmedName,
        trimmedDescription,
        avatarValue,
        avatarUrlValue,
        avatarImageIdValue,
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

// PUT /api/groups/:groupId/avatar - Update group avatar. The photo itself is
// uploaded client-side via window.usernode.uploadFile; this route only ever
// persists the returned URL/id (never image bytes) -- same contract as
// PUT /api/profile.
app.put('/api/groups/:groupId/avatar', async (req, res) => {
  const { avatarUrl, avatarImageId } = req.body || {};
  const { groupId } = req.params;

  if (avatarUrl != null && typeof avatarUrl !== 'string') {
    return res.status(400).json({ error: 'avatarUrl must be a string or null' });
  }
  if (typeof avatarUrl === 'string' && !avatarUrl.startsWith('https://')) {
    return res.status(400).json({ error: 'avatarUrl must be an https:// URL' });
  }

  const role = await getGroupRole(groupId, req.user.id);
  if (role === null) {
    return res.status(404).json({ error: 'Group not found' });
  }
  if (role !== 'owner' && role !== 'admin') {
    return res.status(403).json({ error: 'Only the group creator or an admin can edit group info' });
  }

  const avatarUrlVal = typeof avatarUrl === 'string' ? avatarUrl : null;
  const avatarImageIdVal = typeof avatarImageId === 'string' ? avatarImageId : null;
  await pool.query(
    'UPDATE groups SET avatar_url = $1, avatar_image_id = $2, updated_at = now() WHERE id = $3',
    [avatarUrlVal, avatarImageIdVal, groupId]
  );
  res.json({ id: groupId, avatarUrl: avatarUrlVal, avatarImageId: avatarImageIdVal });
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
      await insertMessage('group', groupId, { id: 'system', username: 'System' },
        { text: `${invitee.username} was added to the group` }, 'system');
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
// (owner/admin only). Removing the group's last member deletes the group
// entirely, matching POST /api/groups/:groupId/leave's own last-member rule.
app.delete('/api/groups/:groupId/members/:memberId', async (req, res) => {
  const { groupId, memberId } = req.params;
  try {
    const requesterRole = await getGroupRole(groupId, req.user.id);
    if (requesterRole === null) {
      return res.status(404).json({ error: 'Group not found' });
    }
    if (requesterRole !== 'owner' && requesterRole !== 'admin') {
      return res.status(403).json({ error: 'Only owners and admins can remove members' });
    }

    const targetRes = await pool.query(
      'SELECT username, role FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, memberId]
    );
    if (targetRes.rowCount === 0) {
      return res.status(404).json({ error: 'Member not found in this group' });
    }
    const target = targetRes.rows[0];
    if (target.role === 'owner') {
      return res.status(400).json({ error: "Cannot remove the group creator" });
    }

    await pool.query('DELETE FROM group_members WHERE group_id = $1 AND user_id = $2', [groupId, memberId]);

    const remainingCount = await pool.query('SELECT COUNT(*)::int AS count FROM group_members WHERE group_id = $1', [groupId]);
    if (remainingCount.rows[0].count === 0) {
      await pool.query('DELETE FROM groups WHERE id = $1', [groupId]);
      return res.json({ id: groupId, members: [], memberCount: 0, message: 'Member removed successfully' });
    }

    await insertMessage('group', groupId, { id: 'system', username: 'System' },
      { text: `${target.username} was removed from the group` }, 'system');

    const group = await loadGroupWithMembers(groupId);
    res.json({
      id: groupId,
      members: group.members,
      memberCount: group.memberCount,
      message: 'Member removed successfully'
    });
  } catch (err) {
    console.error('[groups] remove member failed:', err);
    res.status(500).json({ error: 'Failed to remove member' });
  }
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

  const targetRes = await pool.query('SELECT username, role FROM group_members WHERE group_id = $1 AND user_id = $2', [groupId, memberId]);
  if (targetRes.rowCount === 0) {
    return res.status(404).json({ error: 'Member not found in this group' });
  }
  const target = targetRes.rows[0];
  if (target.role === 'owner') {
    return res.status(400).json({ error: "Cannot change the group creator's role" });
  }

  await pool.query('UPDATE group_members SET role = $1 WHERE group_id = $2 AND user_id = $3', [role, groupId, memberId]);

  const announcement = role === 'admin'
    ? `${target.username} was made an admin`
    : `${target.username} is no longer an admin`;
  await insertMessage('group', groupId, { id: 'system', username: 'System' }, { text: announcement }, 'system');

  res.json({
    id: groupId,
    memberId,
    role,
    message: 'Member role updated successfully'
  });
});

// POST /api/groups/:groupId/leave - Leave the group. If the leaving member
// was the owner, hand ownership to the next admin (or oldest remaining
// member); if they were the last member, the group is deleted entirely.
app.post('/api/groups/:groupId/leave', async (req, res) => {
  const { groupId } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const groupRes = await client.query('SELECT id FROM groups WHERE id = $1', [groupId]);
    if (groupRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Group not found' });
    }

    const memberRes = await client.query(
      'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, req.user.id]
    );
    if (memberRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'You are not a member of this group' });
    }
    const leavingRole = memberRes.rows[0].role;

    await client.query('DELETE FROM group_members WHERE group_id = $1 AND user_id = $2', [groupId, req.user.id]);

    if (leavingRole === 'owner') {
      const remaining = await client.query(
        `SELECT user_id, username FROM group_members WHERE group_id = $1
          ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END, joined_at ASC LIMIT 1`,
        [groupId]
      );
      if (remaining.rowCount > 0) {
        const next = remaining.rows[0];
        await client.query(`UPDATE group_members SET role = 'owner' WHERE group_id = $1 AND user_id = $2`, [groupId, next.user_id]);
        await client.query(
          `UPDATE groups SET creator_user_id = $1, creator_username = $2, updated_at = now() WHERE id = $3`,
          [next.user_id, next.username, groupId]
        );
      } else {
        await client.query('DELETE FROM groups WHERE id = $1', [groupId]);
      }
    }

    await client.query('COMMIT');

    const stillExists = await pool.query('SELECT 1 FROM groups WHERE id = $1', [groupId]);
    if (stillExists.rowCount > 0) {
      await insertMessage('group', groupId, { id: 'system', username: 'System' },
        { text: `${req.user.username || req.user.id} left the group` }, 'system');
    }

    res.json({
      id: groupId,
      isLeftByUser: true,
      message: 'You have left the group'
    });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('[groups] leave failed:', err);
    res.status(500).json({ error: 'Failed to leave group' });
  } finally {
    client.release();
  }
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
    avatarUrl: row.avatar_url || null,
    avatarImageId: row.avatar_image_id || null,
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
              (SELECT COUNT(*) FROM channel_followers f WHERE f.channel_id = c.id) AS follower_count,
              EXISTS (
                SELECT 1 FROM channel_followers f
                 WHERE f.channel_id = c.id AND (f.user_id = $1 OR f.user_id = 'user_self')
              ) AS is_following
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
    res.json({ channels: result.rows.map((row) => shapeChannel(row, row.follower_count, row.is_following)) });
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
  const { name, description, avatar, avatarUrl, avatarImageId } = req.body || {};

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
  const avatarUrlValue = typeof avatarUrl === 'string' && avatarUrl ? avatarUrl : null;
  const avatarImageIdValue = typeof avatarImageId === 'string' && avatarImageId ? avatarImageId : null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO channels (id, name, description, avatar, avatar_url, avatar_image_id, creator_user_id, creator_username)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [channelId, trimmedName, trimmedDescription, avatarValue, avatarUrlValue, avatarImageIdValue, req.user.id, req.user.username || req.user.id]
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

// PUT /api/channels/:channelId/avatar - Update channel avatar. Same
// URL/id-only persistence contract as PUT /api/groups/:groupId/avatar; the
// photo itself is uploaded client-side via window.usernode.uploadFile.
app.put('/api/channels/:channelId/avatar', async (req, res) => {
  const { avatarUrl, avatarImageId } = req.body || {};
  const { channelId } = req.params;

  if (avatarUrl != null && typeof avatarUrl !== 'string') {
    return res.status(400).json({ error: 'avatarUrl must be a string or null' });
  }
  if (typeof avatarUrl === 'string' && !avatarUrl.startsWith('https://')) {
    return res.status(400).json({ error: 'avatarUrl must be an https:// URL' });
  }

  const role = await getChannelRole(channelId, req.user.id);
  if (role === null) {
    return res.status(404).json({ error: 'Channel not found' });
  }
  if (role !== 'owner') {
    return res.status(403).json({ error: 'Only the channel creator can edit channel info' });
  }

  const avatarUrlVal = typeof avatarUrl === 'string' ? avatarUrl : null;
  const avatarImageIdVal = typeof avatarImageId === 'string' ? avatarImageId : null;
  await pool.query(
    'UPDATE channels SET avatar_url = $1, avatar_image_id = $2, updated_at = now() WHERE id = $3',
    [avatarUrlVal, avatarImageIdVal, channelId]
  );
  res.json({ id: channelId, avatarUrl: avatarUrlVal, avatarImageId: avatarImageIdVal });
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
  const { pinned, manuallyMarkedUnread, hiddenFromInbox, markRead } = req.body || {};
  const pinnedVal = typeof pinned === 'boolean' ? pinned : null;
  const unreadVal = typeof manuallyMarkedUnread === 'boolean' ? manuallyMarkedUnread : null;
  const hiddenVal = typeof hiddenFromInbox === 'boolean' ? hiddenFromInbox : null;
  const markReadVal = markRead === true;

  try {
    const result = await pool.query(
      `INSERT INTO conversation_user_state
         (conversation_id, user_id, pinned, manually_marked_unread, hidden_from_inbox, last_read_at)
       VALUES ($1, $2, COALESCE($3, false), COALESCE($4, false), COALESCE($5, false), CASE WHEN $6 THEN now() ELSE NULL END)
       ON CONFLICT (conversation_id, user_id) DO UPDATE SET
         pinned = COALESCE($3, conversation_user_state.pinned),
         manually_marked_unread = COALESCE($4, conversation_user_state.manually_marked_unread),
         hidden_from_inbox = COALESCE($5, conversation_user_state.hidden_from_inbox),
         last_read_at = CASE WHEN $6 THEN now() ELSE conversation_user_state.last_read_at END,
         updated_at = now()
       RETURNING pinned, manually_marked_unread, hidden_from_inbox, last_read_at`,
      [id, req.user.id, pinnedVal, unreadVal, hiddenVal, markReadVal]
    );
    const row = result.rows[0];
    res.json({
      id,
      pinned: row.pinned,
      manuallyMarkedUnread: row.manually_marked_unread,
      hiddenFromInbox: row.hidden_from_inbox,
      lastReadAt: row.last_read_at ? new Date(row.last_read_at).getTime() : null,
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
// Shared lookup for an existing direct_conversations row between two user
// ids, used by both the write path (getOrCreateDirectConversation) and the
// read path (GET /api/messages/direct/:peerId) so a conversation is found
// the same way regardless of whether the caller is about to append to it or
// just reading it.
//
// Tries an exact-id match first, then falls back to matching by peer
// username: users.id isn't guaranteed stable across sessions/logins (the
// platform's JWT `id` claim can differ across logins for the same real
// user) and users.username has no uniqueness constraint, so a returning
// contact (on either side of this pair) can otherwise look like a new peer
// even though a conversation with them already exists. `viaUsernameFallback`
// tells the caller the match only succeeded because of this, so it knows to
// reconcile the row's stored ids.
async function findDirectConversation(userIdA, userIdB) {
  // Match the stored (sorted) pair in either comparison order -- the row was
  // inserted using a sorted pair, but the exact-pair clause here must still
  // work regardless of which of userIdA/userIdB sorts first. Also match a
  // row where one side is the 'user_self' sentinel and the other is EITHER
  // input id (not just the alphabetically-later one) -- same OR-match
  // pattern as getGroupRole/getChannelRole below, applied here so a
  // staging-seeded demo DM (seeded against 'user_self') resolves to
  // whichever real user is currently logged in, instead of a second,
  // duplicate conversation being created underneath it. (Comparing only
  // against the sorted-later id was the bug: when a real user's id sorted
  // after the fixture's id, the sentinel clause silently missed the seeded
  // row and a duplicate got inserted.)
  const existing = await pool.query(
    `SELECT id, status, requested_by_user_id FROM direct_conversations
      WHERE (user_id_a = $1 AND user_id_b = $2)
         OR (user_id_a = $2 AND user_id_b = $1)
         OR (user_id_a = 'user_self' AND (user_id_b = $1 OR user_id_b = $2))
         OR (user_id_b = 'user_self' AND (user_id_a = $1 OR user_id_a = $2))`,
    [userIdA, userIdB]
  );
  if (existing.rowCount > 0) return { row: existing.rows[0], viaUsernameFallback: false };

  // No row matches either input id exactly. Before creating a brand new one,
  // check whether EITHER input id already has a conversation with a
  // DIFFERENT peer id that resolves to the OTHER input id's username.
  // Checked both ways round since either userIdA or userIdB could be the
  // "new" id for a returning party. (mergeDuplicateDirectConversationsByUsername
  // cleans up rows that were already created this way before this check
  // existed.)
  const reuse = await pool.query(
    `SELECT dc.id, dc.status, dc.requested_by_user_id
       FROM direct_conversations dc
       JOIN users peer ON peer.id = (CASE WHEN dc.user_id_a = $1 THEN dc.user_id_b ELSE dc.user_id_a END)
      WHERE (dc.user_id_a = $1 OR dc.user_id_b = $1)
        AND lower(peer.username) = lower((SELECT username FROM users WHERE id = $2))
      UNION
     SELECT dc.id, dc.status, dc.requested_by_user_id
       FROM direct_conversations dc
       JOIN users peer ON peer.id = (CASE WHEN dc.user_id_a = $2 THEN dc.user_id_b ELSE dc.user_id_a END)
      WHERE (dc.user_id_a = $2 OR dc.user_id_b = $2)
        AND lower(peer.username) = lower((SELECT username FROM users WHERE id = $1))
      LIMIT 1`,
    [userIdA, userIdB]
  );
  if (reuse.rowCount > 0) return { row: reuse.rows[0], viaUsernameFallback: true };
  return null;
}

async function getOrCreateDirectConversation(userIdA, userIdB, requesterId) {
  const [a, b] = [userIdA, userIdB].sort();
  const found = await findDirectConversation(userIdA, userIdB);
  if (found) {
    if (found.viaUsernameFallback) {
      // The row was found by username, not by exact id match, which means
      // the platform-issued id for at least one side has drifted since the
      // row was last written. Bring user_id_a/user_id_b back in sync with
      // the currently active ids -- using the same sorted-pair convention as
      // a freshly inserted row -- so exact-match queries elsewhere find this
      // row on the very next request instead of only this write path ever
      // reconciling it.
      //
      // requested_by_user_id can go stale the same way: it's whichever side
      // originally sent the request, stored as THAT side's id at the time.
      // If it no longer matches either current id, resolve it by username
      // against a/b so "pending request I sent" (GET /api/direct-conversations'
      // requested_by_user_id = caller check) keeps recognizing the request as
      // the caller's own after their id has drifted, instead of it silently
      // looking like a request from someone else.
      let requestedBy = found.row.requested_by_user_id;
      if (requestedBy !== a && requestedBy !== b) {
        const match = await pool.query(
          `SELECT id FROM users WHERE id IN ($1, $2)
             AND lower(username) = lower((SELECT username FROM users WHERE id = $3))`,
          [a, b, requestedBy]
        );
        if (match.rowCount > 0) requestedBy = match.rows[0].id;
      }
      await pool.query(
        'UPDATE direct_conversations SET user_id_a = $1, user_id_b = $2, requested_by_user_id = $3 WHERE id = $4',
        [a, b, requestedBy, found.row.id]
      );
      found.row.requested_by_user_id = requestedBy;
    }
    return found.row;
  }

  const id = 'dm_' + crypto.randomBytes(12).toString('hex');
  await pool.query(
    `INSERT INTO direct_conversations (id, user_id_a, user_id_b, status, requested_by_user_id)
     VALUES ($1, $2, $3, 'pending', $4)
     ON CONFLICT (user_id_a, user_id_b) DO NOTHING`,
    [id, a, b, requesterId]
  );
  const row = await pool.query(
    'SELECT id, status, requested_by_user_id FROM direct_conversations WHERE user_id_a = $1 AND user_id_b = $2',
    [a, b]
  );
  return row.rows[0];
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
  if (row.kind === 'system') {
    msg.isSystemMessage = true;
  }
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
// `kind` is an internal-only override, never read from `body` -- callers
// serving the public POST /api/messages/direct|group/:id endpoints must
// never pass one through from req.body, or any user could forge a fake
// "System" announcement. Only server-triggered call sites (role change,
// member removal, leaving) pass kind: 'system'.
async function insertMessage(conversationType, conversationId, sender, body, kind) {
  const id = typeof (body && body.id) === 'string' && body.id.trim()
    ? body.id.trim().slice(0, 100)
    : `msg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const text = typeof (body && body.text) === 'string' ? body.text.slice(0, MAX_MESSAGE_TEXT_LENGTH) : '';
  const imageUrl = typeof (body && body.imageUrl) === 'string' ? body.imageUrl : null;
  const imageId = typeof (body && body.imageId) === 'string' ? body.imageId : null;
  const replyTo = body && body.replyTo && typeof body.replyTo === 'object' ? body.replyTo : null;
  const messageKind = kind === 'system' ? 'system' : 'text';

  await pool.query(
    `INSERT INTO messages
       (id, conversation_type, conversation_id, sender_user_id, sender_username,
        text, image_url, image_id, reply_to_message_id, reply_to_sender_name, reply_to_preview_text, kind)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (id) DO NOTHING`,
    [
      id, conversationType, conversationId, sender.id, sender.username || sender.id,
      text, imageUrl, imageId,
      replyTo ? String(replyTo.messageId || '').slice(0, 100) || null : null,
      replyTo ? String(replyTo.senderName || '').slice(0, 80) : null,
      replyTo ? String(replyTo.previewText || '').slice(0, 200) : null,
      messageKind
    ]
  );
  const row = await pool.query('SELECT * FROM messages WHERE id = $1', [id]);
  return shapeMessage(row.rows[0]);
}

// userId is optional: when given, messages that user has hidden-for-self
// (see message_hidden_for / POST .../hide below) are excluded -- otherwise a
// deleted-for-me message reappears on the very next fetch (e.g. a reload),
// since the underlying row is never actually removed.
async function listMessages(conversationType, conversationId, userId) {
  const result = await pool.query(
    `SELECT * FROM (
        SELECT m.* FROM messages m
         WHERE m.conversation_type = $1 AND m.conversation_id = $2
           AND NOT EXISTS (
             SELECT 1 FROM message_hidden_for mhf
              WHERE mhf.message_id = m.id AND mhf.user_id = $3
           )
         ORDER BY m.created_at DESC LIMIT 500
     ) recent ORDER BY created_at ASC`,
    [conversationType, conversationId, userId || null]
  );
  return result.rows.map(shapeMessage);
}

// ---------------------------------------------------------------------------
// Messaging API Endpoints
// ---------------------------------------------------------------------------

// GET /api/direct-conversations - list the caller's real DM conversations
// (peer identity + last message), so the inbox survives a reload instead of
// only ever existing in that tab's in-memory `conversations` array.
// Recipients of a still-pending request are excluded here -- they see it
// under GET /api/message-requests instead, not in the normal inbox.
app.get('/api/direct-conversations', async (req, res) => {
  try {
    // "Is user_id_a the caller" has to tolerate id drift too: a row found
    // only because its username still matches the caller's (exact id match
    // missed) must still resolve the CORRECT side as peer, or the caller's
    // own drifted-id row would show up with the caller listed as their own
    // peer. ua/ub carry each side's username purely for that self/peer
    // determination -- reused for the peer-identity joins below and for the
    // WHERE clause's own username fallback.
    const result = await pool.query(
      `SELECT dc.id, dc.user_id_a, dc.user_id_b, dc.status, dc.requested_by_user_id,
              ua.username AS a_username,
              u.username AS peer_username, u.usernode_pubkey AS peer_pubkey,
              lm.text AS last_text, lm.sender_user_id AS last_sender_id, lm.created_at AS last_at,
              cus.pinned AS pinned, cus.hidden_from_inbox AS hidden_from_inbox,
              COALESCE(unread.count, 0) AS unread_count
         FROM direct_conversations dc
         LEFT JOIN users ua ON ua.id = dc.user_id_a
         LEFT JOIN users ub ON ub.id = dc.user_id_b
         LEFT JOIN users req_user ON req_user.id = dc.requested_by_user_id
         LEFT JOIN users u ON u.id = (
           CASE WHEN dc.user_id_a = $1 OR dc.user_id_a = 'user_self' OR lower(ua.username) = lower($2)
                THEN dc.user_id_b ELSE dc.user_id_a END
         )
         LEFT JOIN LATERAL (
           SELECT text, sender_user_id, created_at FROM messages
            WHERE conversation_type = 'direct' AND conversation_id = dc.id
            ORDER BY created_at DESC LIMIT 1
         ) lm ON true
         LEFT JOIN conversation_user_state cus
           ON cus.conversation_id = 'conv_' || (
                CASE WHEN dc.user_id_a = $1 OR dc.user_id_a = 'user_self' OR lower(ua.username) = lower($2)
                     THEN dc.user_id_b ELSE dc.user_id_a END
              )
          AND cus.user_id = $1
         LEFT JOIN LATERAL (
           SELECT count(*)::int AS count FROM messages
            WHERE conversation_type = 'direct' AND conversation_id = dc.id
              AND sender_user_id != $1
              AND (cus.last_read_at IS NULL OR created_at > cus.last_read_at)
         ) unread ON true
        WHERE (dc.user_id_a = $1 OR dc.user_id_b = $1 OR dc.user_id_a = 'user_self' OR dc.user_id_b = 'user_self'
               OR lower(ua.username) = lower($2) OR lower(ub.username) = lower($2))
          AND (dc.status = 'accepted' OR dc.requested_by_user_id = $1
               OR lower(req_user.username) = lower($2))
        ORDER BY COALESCE(lm.created_at, dc.created_at) DESC`,
      [req.user.id, req.user.username]
    );
    // Two rows can legitimately resolve to the same peer username (see
    // mergeDuplicateDirectConversationsByUsername) if the migration hasn't
    // run since the duplicate appeared -- dedupe defensively here too so the
    // inbox never shows the same contact twice. Rows already arrive ordered
    // by most-recent activity first, so keeping the first occurrence per
    // (lowercased) username keeps the most active thread.
    const seenPeerUsernames = new Set();
    const conversations = [];
    for (const row of result.rows) {
      const isSelfA = row.user_id_a === req.user.id || row.user_id_a === 'user_self'
        || (row.a_username && row.a_username.toLowerCase() === req.user.username.toLowerCase());
      const peerId = isSelfA ? row.user_id_b : row.user_id_a;
      // The peer may not have a `users` row yet (they've never loaded the app
      // in this environment) -- that must NOT hide an otherwise valid,
      // already-persisted conversation from the caller's own list, so fall
      // back to the peer id itself for both the dedup key and display name
      // rather than dropping the row (previously an INNER JOIN did exactly
      // that).
      const usernameKey = row.peer_username ? row.peer_username.toLowerCase() : `id:${peerId}`;
      if (seenPeerUsernames.has(usernameKey)) continue;
      seenPeerUsernames.add(usernameKey);
      conversations.push({
        peerId,
        peerUsername: row.peer_username || peerId,
        peerWalletAddress: row.peer_pubkey || null,
        lastMessage: row.last_text || null,
        lastMessageSenderId: row.last_sender_id || null,
        lastMessageAt: row.last_at ? new Date(row.last_at).getTime() : null,
        requestStatus: row.status === 'pending' ? 'pending_sent' : 'accepted',
        pinned: row.pinned || false,
        hiddenFromInbox: row.hidden_from_inbox || false,
        unreadCount: row.unread_count || 0
      });
    }
    res.json({ conversations });
  } catch (err) {
    console.error('[messages] direct-conversations list failed:', err);
    res.status(500).json({ error: 'Failed to load conversations' });
  }
});

// GET /api/message-requests - the caller's incoming pending DM requests:
// conversations someone else started that the caller hasn't accepted yet.
app.get('/api/message-requests', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT dc.id, dc.requested_by_user_id, dc.created_at,
              u.username AS sender_username, u.usernode_pubkey AS sender_pubkey,
              fm.text AS preview_text, fm.created_at AS first_at
         FROM direct_conversations dc
         LEFT JOIN users u ON u.id = dc.requested_by_user_id
         LEFT JOIN LATERAL (
           SELECT text, created_at FROM messages
            WHERE conversation_type = 'direct' AND conversation_id = dc.id
            ORDER BY created_at ASC LIMIT 1
         ) fm ON true
        WHERE (dc.user_id_a = $1 OR dc.user_id_b = $1 OR dc.user_id_a = 'user_self' OR dc.user_id_b = 'user_self')
          AND dc.status = 'pending'
          AND dc.requested_by_user_id != $1
        ORDER BY COALESCE(fm.created_at, dc.created_at) DESC`,
      [req.user.id]
    );
    res.json({
      requests: result.rows.map((row) => ({
        id: row.id,
        senderId: row.requested_by_user_id,
        senderUsername: row.sender_username || row.requested_by_user_id,
        senderWalletAddress: row.sender_pubkey || null,
        messagePreview: row.preview_text || null,
        timestamp: new Date(row.first_at || row.created_at).getTime()
      }))
    });
  } catch (err) {
    console.error('[messages] message-requests list failed:', err);
    res.status(500).json({ error: 'Failed to load message requests' });
  }
});

// POST /api/message-requests/:conversationId/accept - recipient accepts a
// pending DM request; the conversation becomes a normal accepted thread.
app.post('/api/message-requests/:conversationId/accept', async (req, res) => {
  try {
    const convRes = await pool.query(
      'SELECT id, user_id_a, user_id_b, status, requested_by_user_id FROM direct_conversations WHERE id = $1',
      [req.params.conversationId]
    );
    if (convRes.rowCount === 0) return res.status(404).json({ error: 'Request not found' });
    const conv = convRes.rows[0];
    const isParticipant = conv.user_id_a === req.user.id || conv.user_id_b === req.user.id
      || conv.user_id_a === 'user_self' || conv.user_id_b === 'user_self';
    if (!isParticipant || conv.requested_by_user_id === req.user.id) {
      return res.status(404).json({ error: 'Request not found' });
    }
    await pool.query(`UPDATE direct_conversations SET status = 'accepted' WHERE id = $1`, [conv.id]);
    res.json({ id: conv.id, status: 'accepted' });
  } catch (err) {
    console.error('[messages] message-request accept failed:', err);
    res.status(500).json({ error: 'Failed to accept request' });
  }
});

// POST /api/message-requests/:conversationId/decline - recipient declines a
// pending DM request. Hard-deletes the conversation and its messages rather
// than flagging it 'declined': the sender is never told, so nothing needs to
// keep blocking them -- a later message from the same sender just starts a
// fresh pending request.
app.post('/api/message-requests/:conversationId/decline', async (req, res) => {
  try {
    const convRes = await pool.query(
      'SELECT id, user_id_a, user_id_b, status, requested_by_user_id FROM direct_conversations WHERE id = $1',
      [req.params.conversationId]
    );
    if (convRes.rowCount === 0) return res.status(404).json({ error: 'Request not found' });
    const conv = convRes.rows[0];
    const isParticipant = conv.user_id_a === req.user.id || conv.user_id_b === req.user.id
      || conv.user_id_a === 'user_self' || conv.user_id_b === 'user_self';
    if (!isParticipant || conv.requested_by_user_id === req.user.id || conv.status !== 'pending') {
      return res.status(404).json({ error: 'Request not found' });
    }
    await pool.query(`DELETE FROM messages WHERE conversation_type = 'direct' AND conversation_id = $1`, [conv.id]);
    await pool.query('DELETE FROM direct_conversations WHERE id = $1', [conv.id]);
    res.json({ id: conv.id, status: 'declined' });
  } catch (err) {
    console.error('[messages] message-request decline failed:', err);
    res.status(500).json({ error: 'Failed to decline request' });
  }
});

// GET /api/messages/direct/:peerId - full history of the caller's DM thread
// with peerId. Scoped by construction: the conversation row is looked up (or
// simply doesn't exist yet) for req.user + peerId, so there's no conversation
// id a caller could pass to read someone else's thread.
app.get('/api/messages/direct/:peerId', async (req, res) => {
  try {
    const peerId = req.params.peerId;
    // Uses the same exact-id-then-username-fallback lookup as
    // getOrCreateDirectConversation, so a conversation whose stored ids have
    // drifted from the caller's (or peer's) current session id still loads
    // its history here instead of appearing empty just because the write
    // path hasn't reconciled the row yet.
    const found = await findDirectConversation(req.user.id, peerId);
    if (!found) return res.json({ messages: [] });
    res.json({ messages: await listMessages('direct', found.row.id, req.user.id) });
  } catch (err) {
    console.error('[messages] direct fetch failed:', err);
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

// POST /api/messages/direct/:peerId - send a DM. Any authenticated user can
// message any other; the conversation row is created on first send, as a
// pending message request unless one of the two has already messaged the
// other before. If the pending request's recipient is the one sending this
// message (i.e. they're replying instead of tapping Accept), that reply
// implicitly accepts the request.
app.post('/api/messages/direct/:peerId', async (req, res) => {
  const peerId = req.params.peerId;
  if (peerId === req.user.id) return res.status(400).json({ error: "Can't message yourself" });
  try {
    const conversation = await getOrCreateDirectConversation(req.user.id, peerId, req.user.id);
    if (conversation.status === 'pending' && conversation.requested_by_user_id !== req.user.id) {
      await pool.query(
        `UPDATE direct_conversations SET status = 'accepted' WHERE id = $1`,
        [conversation.id]
      );
    }
    const message = await insertMessage('direct', conversation.id, req.user, req.body);
    res.status(201).json({ message });
  } catch (err) {
    console.error('[messages] direct send failed:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// POST /api/messages/direct/:peerId/:messageId/delete - "delete for
// everyone": permanently removes the message row, so neither participant's
// client will ever be served it again (as opposed to /clear below, which only
// hides messages from the caller's own view). Either participant may delete
// any message in a thread they're part of, matching the client's long-press
// menu. Scoped through the same peerId conversation lookup as the GET route
// above, so a caller can't delete a message belonging to a thread they're not
// part of. Also clears any leftover message_hidden_for rows for the deleted
// id, though those are harmless once the message row itself is gone.
app.post('/api/messages/direct/:peerId/:messageId/delete', async (req, res) => {
  try {
    const { peerId, messageId } = req.params;
    const convRes = await pool.query(
      `SELECT id FROM direct_conversations
        WHERE (user_id_a = $1 AND user_id_b = $2)
           OR (user_id_a = $2 AND user_id_b = $1)
           OR (user_id_a = 'user_self' AND user_id_b = $2)
           OR (user_id_b = 'user_self' AND user_id_a = $2)`,
      [req.user.id, peerId]
    );
    if (convRes.rowCount === 0) return res.status(404).json({ error: 'Conversation not found' });
    const conversationId = convRes.rows[0].id;
    const delRes = await pool.query(
      `DELETE FROM messages WHERE id = $1 AND conversation_type = 'direct' AND conversation_id = $2`,
      [messageId, conversationId]
    );
    if (delRes.rowCount === 0) return res.status(404).json({ error: 'Message not found' });
    await pool.query(`DELETE FROM message_hidden_for WHERE message_id = $1`, [messageId]);
    res.json({ id: messageId, deleted: true });
  } catch (err) {
    console.error('[messages] direct delete failed:', err);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// POST /api/messages/direct/:peerId/clear - "clear chat" for the caller only:
// hides every message currently in this DM thread, same mechanism as the
// single-message /hide route above (bulk-inserts into message_hidden_for
// instead of one row). Only messages that exist at clear-time are hidden --
// anything the peer sends afterwards is a fresh row with no matching
// message_hidden_for entry, so it still shows up normally.
app.post('/api/messages/direct/:peerId/clear', async (req, res) => {
  try {
    const { peerId } = req.params;
    const convRes = await pool.query(
      `SELECT id FROM direct_conversations
        WHERE (user_id_a = $1 AND user_id_b = $2)
           OR (user_id_a = $2 AND user_id_b = $1)
           OR (user_id_a = 'user_self' AND user_id_b = $2)
           OR (user_id_b = 'user_self' AND user_id_a = $2)`,
      [req.user.id, peerId]
    );
    if (convRes.rowCount === 0) return res.status(404).json({ error: 'Conversation not found' });
    const conversationId = convRes.rows[0].id;
    await pool.query(
      `INSERT INTO message_hidden_for (message_id, user_id)
       SELECT id, $2 FROM messages WHERE conversation_type = 'direct' AND conversation_id = $1
       ON CONFLICT (message_id, user_id) DO NOTHING`,
      [conversationId, req.user.id]
    );
    res.json({ id: conversationId, cleared: true });
  } catch (err) {
    console.error('[messages] direct clear failed:', err);
    res.status(500).json({ error: 'Failed to clear chat' });
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

// POST /api/messages/group/:groupId/:messageId/delete - "delete for
// everyone": permanently removes the message row so no member's client is
// ever served it again. Own messages may be deleted by their sender; owners
// and admins may additionally delete anyone's message (moderation).
app.post('/api/messages/group/:groupId/:messageId/delete', async (req, res) => {
  try {
    const { groupId, messageId } = req.params;
    const role = await getGroupRole(groupId, req.user.id);
    if (role === null) return res.status(404).json({ error: 'Group not found' });
    const msgRes = await pool.query(
      `SELECT sender_user_id FROM messages WHERE id = $1 AND conversation_type = 'group' AND conversation_id = $2`,
      [messageId, groupId]
    );
    if (msgRes.rowCount === 0) return res.status(404).json({ error: 'Message not found' });
    const isOwnMessage = msgRes.rows[0].sender_user_id === req.user.id;
    const isAdmin = role === 'owner' || role === 'admin';
    if (!isOwnMessage && !isAdmin) {
      return res.status(403).json({ error: 'You can only delete your own messages' });
    }
    await pool.query(`DELETE FROM messages WHERE id = $1`, [messageId]);
    res.json({ id: messageId, deleted: true });
  } catch (err) {
    console.error('[messages] group delete failed:', err);
    res.status(500).json({ error: 'Failed to delete message' });
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

// POST /api/messages/channel/:channelId/:messageId/delete - "delete for
// everyone": permanently removes the message row so no follower's client is
// ever served it again. Only the sender may delete it -- in practice only the
// channel owner ever posts (see POST above), so this is effectively
// owner-only too.
app.post('/api/messages/channel/:channelId/:messageId/delete', async (req, res) => {
  try {
    const { channelId, messageId } = req.params;
    const role = await getChannelRole(channelId, req.user.id);
    if (role === null) return res.status(404).json({ error: 'Channel not found' });
    const msgRes = await pool.query(
      `SELECT sender_user_id FROM messages WHERE id = $1 AND conversation_type = 'channel' AND conversation_id = $2`,
      [messageId, channelId]
    );
    if (msgRes.rowCount === 0) return res.status(404).json({ error: 'Message not found' });
    if (msgRes.rows[0].sender_user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own messages' });
    }
    await pool.query(`DELETE FROM messages WHERE id = $1`, [messageId]);
    res.json({ id: messageId, deleted: true });
  } catch (err) {
    console.error('[messages] channel delete failed:', err);
    res.status(500).json({ error: 'Failed to delete message' });
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
    // avatar (above) stays the short initials-fallback string; a real uploaded
    // photo lives here as a platform-storage URL/id, mirroring users.avatar_url
    // / users.avatar_image_id -- never image bytes in this column.
    await pool.query(`ALTER TABLE groups ADD COLUMN IF NOT EXISTS avatar_url TEXT`);
    await pool.query(`ALTER TABLE groups ADD COLUMN IF NOT EXISTS avatar_image_id TEXT`);

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
    // Message-requests support: a brand-new conversation starts 'pending'
    // until the recipient accepts (or replies, which counts as accepting).
    // DEFAULT 'accepted' means every row that already existed before this
    // migration ran is grandfathered in as accepted for free.
    await pool.query(`
      ALTER TABLE direct_conversations
        ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'accepted'
          CHECK (status IN ('pending', 'accepted'))
    `);
    await pool.query(`
      ALTER TABLE direct_conversations
        ADD COLUMN IF NOT EXISTS requested_by_user_id TEXT
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
    // Same avatar_url/avatar_image_id split as groups above.
    await pool.query(`ALTER TABLE channels ADD COLUMN IF NOT EXISTS avatar_url TEXT`);
    await pool.query(`ALTER TABLE channels ADD COLUMN IF NOT EXISTS avatar_image_id TEXT`);

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
    // 'system' rows are server-generated announcements (role changes, member
    // removal, leaving) -- never settable from the public POST /api/messages/*
    // body, only from internal insertMessage(..., { kind: 'system' }) calls.
    await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'text'`);

    // "Delete for me" on a DM message: the sender or recipient can hide any
    // message from their own view without affecting the other participant's
    // history. Previously this only ever mutated an in-memory flag on the
    // client, so it silently reappeared on every reload.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS message_hidden_for (
        message_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (message_id, user_id)
      );
    `);

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

    // No row here yet means "never explicitly read" -- GET /api/direct-conversations
    // treats a missing row as 0 unread (not "everything since forever"), so
    // existing threads don't retroactively light up unread the moment this
    // column ships. Only messages that arrive *after* a row exists count.
    await pool.query(
      `ALTER TABLE conversation_user_state ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ`
    );

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

    // The admin-promotion bell/notifications feature was removed in favor of
    // an in-thread system message, so the table is no longer needed.
    await pool.query(`DROP TABLE IF EXISTS notifications`);

    // Private: a private group's name/description is member-only content, and
    // group_members maps a username to every community they belong to — more
    // than a public profile exposes. Staging therefore gets schema only, which
    // is why the seed block below is mandatory.
    await pool.query(`COMMENT ON TABLE groups IS 'staging:private'`);
    await pool.query(`COMMENT ON TABLE group_members IS 'staging:private'`);
    // Private: a hidden_from_inbox/pinned row ties a real user_id to a
    // specific conversation_id, which can reveal who a user is DMing.
    await pool.query(`COMMENT ON TABLE conversation_user_state IS 'staging:private'`);
    // Private: ties a real user_id to a specific message_id they hid.
    await pool.query(`COMMENT ON TABLE message_hidden_for IS 'staging:private'`);
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

  await mergeDuplicateDirectConversationsByUsername();
  await seedStagingData();
}

// direct_conversations has a UNIQUE (user_id_a, user_id_b) constraint, so two
// rows can never share the exact same pair of ids -- but a caller can still
// end up with two rows for what looks like the same contact if that peer's
// users.id changed across logins (the JWT's `id` claim isn't documented as
// stable long-term) or two accounts share a username (users.username has no
// uniqueness constraint). Either way it surfaces as the same contact
// duplicated in the Messages list. This merges such rows -- created before
// the reuse check in getOrCreateDirectConversation existed to prevent new
// ones -- into whichever row has the most message activity, moving messages
// over rather than dropping them. Sentinel ('user_self') rows are excluded:
// those are staging fixtures shared across every real user and are handled
// separately by getOrCreateDirectConversation's sentinel matching.
async function mergeDuplicateDirectConversationsByUsername() {
  try {
    const groups = await pool.query(`
      WITH endpoints AS (
        SELECT id AS dc_id, user_id_a AS caller_id, user_id_b AS peer_id FROM direct_conversations
         WHERE user_id_a != 'user_self' AND user_id_b != 'user_self'
        UNION ALL
        SELECT id AS dc_id, user_id_b AS caller_id, user_id_a AS peer_id FROM direct_conversations
         WHERE user_id_a != 'user_self' AND user_id_b != 'user_self'
      )
      SELECT e.caller_id AS caller_id, lower(u.username) AS peer_username_lc,
             array_agg(DISTINCT e.dc_id) AS dc_ids
        FROM endpoints e
        JOIN users u ON u.id = e.peer_id
       GROUP BY e.caller_id, lower(u.username)
      HAVING count(DISTINCT e.dc_id) > 1
    `);

    for (const group of groups.rows) {
      // Re-check which ids still exist -- an earlier group in this loop may
      // already have deleted one (a row can appear in two different callers'
      // duplicate groups at once).
      const rows = (await pool.query(
        `SELECT dc.id, dc.user_id_a, dc.user_id_b, dc.created_at, dc.requested_by_user_id,
                (SELECT count(*) FROM messages WHERE conversation_type = 'direct' AND conversation_id = dc.id) AS message_count,
                (SELECT max(created_at) FROM messages WHERE conversation_type = 'direct' AND conversation_id = dc.id) AS last_message_at
           FROM direct_conversations dc WHERE dc.id = ANY($1)`,
        [group.dc_ids]
      )).rows;
      if (rows.length < 2) continue;

      rows.sort((r1, r2) => {
        if (r1.message_count !== r2.message_count) return r2.message_count - r1.message_count;
        const t1 = r1.last_message_at ? new Date(r1.last_message_at).getTime() : 0;
        const t2 = r2.last_message_at ? new Date(r2.last_message_at).getTime() : 0;
        if (t1 !== t2) return t2 - t1;
        return new Date(r1.created_at) - new Date(r2.created_at);
      });
      const canonical = rows[0];
      const stale = rows.slice(1);

      for (const row of stale) {
        await pool.query(
          `UPDATE messages SET conversation_id = $1 WHERE conversation_type = 'direct' AND conversation_id = $2`,
          [canonical.id, row.id]
        );
        const stalePeerId = row.user_id_a === group.caller_id ? row.user_id_b : row.user_id_a;
        await pool.query(
          `DELETE FROM conversation_user_state WHERE conversation_id = $1 AND user_id = $2`,
          ['conv_' + stalePeerId, group.caller_id]
        );
        await pool.query(`DELETE FROM direct_conversations WHERE id = $1`, [row.id]);
      }

      // The rows in this group share a caller_id and peer username but were
      // duplicates precisely because their PEER id differs -- the canonical
      // row (picked above for message history) isn't necessarily the one
      // holding the peer's most current id. The most-recently-created row is
      // the best available signal for "current": before the reuse check in
      // getOrCreateDirectConversation existed, a new row only got created
      // here because the peer's id had already moved on from every existing
      // row's stored id. Reconcile the surviving row's ids to that pairing,
      // same sorted-pair convention as everywhere else.
      const mostRecent = rows.reduce(
        (best, r) => (!best || new Date(r.created_at) > new Date(best.created_at)) ? r : best,
        null
      );
      const mostRecentPeerId = mostRecent.user_id_a === group.caller_id ? mostRecent.user_id_b : mostRecent.user_id_a;
      const [a, b] = [group.caller_id, mostRecentPeerId].sort();
      // requested_by_user_id is stored as whichever side's id was current at
      // request time -- same staleness risk as user_id_a/user_id_b above.
      // Resolve it against the reconciled pair by username so a request the
      // caller originally sent doesn't start looking like one they received
      // (see the matching fix in getOrCreateDirectConversation).
      let requestedBy = canonical.requested_by_user_id;
      if (requestedBy !== a && requestedBy !== b) {
        const match = await pool.query(
          `SELECT id FROM users WHERE id IN ($1, $2)
             AND lower(username) = lower((SELECT username FROM users WHERE id = $3))`,
          [a, b, requestedBy]
        );
        if (match.rowCount > 0) requestedBy = match.rows[0].id;
      }
      if (canonical.user_id_a !== a || canonical.user_id_b !== b || canonical.requested_by_user_id !== requestedBy) {
        await pool.query(
          'UPDATE direct_conversations SET user_id_a = $1, user_id_b = $2, requested_by_user_id = $3 WHERE id = $4',
          [a, b, requestedBy, canonical.id]
        );
      }
      console.log(
        `[migration] merged ${stale.length} duplicate direct_conversations row(s) for caller ${group.caller_id} ` +
        `(peer username "${group.peer_username_lc}") into ${canonical.id}`
      );
    }
  } catch (err) {
    console.error('[migration] mergeDuplicateDirectConversationsByUsername failed:', err);
  }
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
  await seedStagingDirectConversations();
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
      `INSERT INTO groups (id, name, description, avatar, avatar_url, visibility, creator_user_id, creator_username)
       VALUES ($1, 'Staging Demo Owned Group', 'Staging demo group — owned by whoever is currently testing, for owner-only UI checks.', 'SO', 'https://picsum.photos/seed/group-staging-owned-1/200', 'public', $2, $3)
       ON CONFLICT (id) DO UPDATE SET creator_user_id = EXCLUDED.creator_user_id, creator_username = EXCLUDED.creator_username, avatar_url = EXCLUDED.avatar_url`,
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
      `INSERT INTO channels (id, name, description, avatar, avatar_url, creator_user_id, creator_username)
       VALUES ($1, 'Staging Demo Owned Channel', 'Staging demo channel — owned by whoever is currently testing, for owner-only UI checks.', 'SC', 'https://picsum.photos/seed/channel-staging-owned-1/200', $2, $3)
       ON CONFLICT (id) DO UPDATE SET creator_user_id = EXCLUDED.creator_user_id, creator_username = EXCLUDED.creator_username, avatar_url = EXCLUDED.avatar_url`,
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
    // re-pointing: user_id already IS whoever is currently testing. Both flags
    // are set on the same owned-group conversation row -- ON CONFLICT DO
    // UPDATE only touches the named column, so the two inserts don't clobber
    // each other regardless of order.
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
      [`conv_${groupId}`, me.id]
    );

    // Fixed-id "member added" system message -- gives staging's owned group
    // an in-thread announcement to check for, mirroring what a real
    // POST /api/groups/:groupId/members call produces (fixed id + ON
    // CONFLICT DO NOTHING means this is safe to call unconditionally, even
    // for groups seeded before this fixture existed).
    await insertMessage('group', groupId, { id: 'system', username: 'System' },
      { id: `msg_${groupId}_3`, text: `${helper.username} was added to the group` }, 'system');

    // Fixed-id "sent by me" message, re-pointed to whoever is currently
    // testing (boot-time seeding in seedStagingDirectConversations can't do
    // this -- it has no real user id to attribute the message to). Paired
    // with the boot-seeded received message in the same thread, this gives
    // dm_staging_mixed_1 one message in each direction, and being the newer
    // of the two, its text is what the Messages list preview must show --
    // regression coverage for the "sent and received DMs don't show up in
    // the list" bug report.
    await pool.query(
      `INSERT INTO messages (id, conversation_type, conversation_id, sender_user_id, sender_username, text, created_at)
       VALUES ('msg_staging_mixed_sent', 'direct', 'dm_staging_mixed_1', $1, $2, 'Shot mixed check: sent message', now() - '35 minutes'::interval)
       ON CONFLICT (id) DO UPDATE SET sender_user_id = EXCLUDED.sender_user_id, sender_username = EXCLUDED.sender_username, created_at = now() - '35 minutes'::interval`,
      [me.id, me.username]
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
    // Referenced throughout groups/channels/DM seed data below as owner/member
    // fixtures, but never had their own `users` row -- avatar_url join in
    // loadGroupWithMembers/GET /api/groups silently returned null for them.
    { id: 'staging-demo-user-2', username: 'staging-demo-ana', pubkey: '0x3e5c7d9f1b3a5c7e9f1b3d5a7c9e1f3b5d7a9c1e', offset: '1 hour', avatarUrl: 'https://picsum.photos/seed/staging-demo-ana/200' },
    { id: 'staging-demo-user-3', username: 'staging-demo-budi', pubkey: '0x7a9c1e3f5b7d9a1c3e5f7b9d1a3c5e7f9b1d3a5c', offset: '90 minutes', avatarUrl: 'https://picsum.photos/seed/staging-demo-budi/200' },
    { id: 'staging-demo-user-4', username: 'staging-demo-citra', pubkey: '0x1f3a9c2e7b5d44680a9f0c1e2d3b4a5968f7e6d5', offset: '5 minutes' },
    { id: 'staging-demo-user-5', username: 'staging-demo-dedi', pubkey: '0x8b2e4f6a1c9d3e5b7a0f2c4e6d8b9a1f3e5c7d09', offset: '2 hours' },
    // Regression fixture peer for SHOT_PERSIST_REMOVAL -- a real group/channel/DM
    // the shot creates and then leaves/unfollows/hides, to prove the removal
    // survives a simulated app restart. Needs a `users` row of its own so the
    // DM join in GET /api/direct-conversations resolves it.
    { id: 'staging-demo-user-6', username: 'staging-demo-eko', pubkey: '0x6a8c0e2f4b6d8a0c2e4f6a8b0d1f3597', offset: '4 hours' },
    { id: 'staging-demo-user-7', username: 'staging-demo-fajar', pubkey: '0x4c7d9e1b3a5f60820c4e6a8f0b2d4e6c8a0f2e4d', offset: '3 days' },
    { id: 'staging-demo-user-8', username: 'staging-demo-gita', pubkey: '0x9e1c3a5b7d9f02460a8c0e2f4b6d8a0c2e4f6a8b', offset: '10 days' },
    { id: 'staging-demo-user-9', username: 'staging-demo-hasan', pubkey: '0x2a4c6e8b0d1f35970b9d1f3e5a7c9b1d3f5a7c9e', offset: '30 days' },
    // Ids deliberately picked to sort below/above any realistic real user id
    // (wallet-style hex, uuid, numeric) -- regression fixtures for the DM
    // history reload bug, which only reproduced when the caller's id sorted
    // on a particular side of the peer's id. See SHOT_DM_RELOAD_LO/HI.
    { id: '0000-reload-order-lo', username: 'staging-demo-zero', pubkey: null, offset: '15 days' },
    { id: 'zzzz-reload-order-hi', username: 'staging-demo-zulu', pubkey: null, offset: '16 days' },
    // Two DIFFERENT ids sharing the SAME username -- regression fixture for
    // the "same contact shows up twice" bug: users.id isn't guaranteed
    // stable across sessions and users.username has no uniqueness
    // constraint, so a returning contact can look like a brand new peer.
    // See SHOT_DM_USERNAME_DUP.
    { id: 'staging-demo-user-10', username: 'staging-demo-dup-name', pubkey: null, offset: '20 days' },
    { id: 'staging-demo-user-11', username: 'staging-demo-dup-name', pubkey: null, offset: '1 minute' },
    // Dedicated target peer for SHOT_REPLY_LEAK -- kept separate from every
    // other DM fixture so sending a shot message into this thread can't
    // change conversation_user_state on a conversation another test asserts
    // an "untouched" or "500+ message" precondition against.
    { id: 'staging-demo-user-12', username: 'staging-demo-ivan', pubkey: '0x5d7f9b1e3c5a7d9f1b3e5c7a9d1f3b5e7c9a1d3f', offset: '6 hours' },
    // Peer for the mixed-direction DM fixture (both a received AND a sent
    // message in the same thread) -- regression coverage for the Messages
    // list bug report where sent+received DMs failed to show up in the list.
    { id: 'staging-demo-user-13', username: 'staging-demo-joko', pubkey: '0x0b2d4f6810c2e4a6890c2e4f6a8b0d2f4e6a8c0e', offset: '45 minutes' }
  ];

  try {
    for (const seed of seeds) {
      await pool.query(
        `INSERT INTO users (id, username, usernode_pubkey, last_seen_at, avatar_url)
         VALUES ($1, $2, $3, now() - $4::interval, $5)
         ON CONFLICT (id) DO NOTHING`,
        [seed.id, seed.username, seed.pubkey, seed.offset, seed.avatarUrl || null]
      );
    }
    console.log('Staging demo users seeded');
  } catch (err) {
    console.error('Staging user seed error:', err);
  }
}

// Staging seed for direct_conversations (also staging:private, so a fresh
// staging DB has none). One 'user_self' row is left 'pending' so the Requests
// tab has something to show, and one is 'accepted' so the inbox and thread
// view aren't empty either. Both target 'user_self' -- the OR-match sentinel
// in getOrCreateDirectConversation/the message-request endpoints -- so they
// resolve to whichever real user is logged in, on either side.
async function seedStagingDirectConversations() {
  if (!IS_STAGING) return;

  try {
    await pool.query(
      `INSERT INTO direct_conversations (id, user_id_a, user_id_b, status, requested_by_user_id, created_at)
       VALUES ('dm_staging_pending_1', 'staging-demo-user-4', 'user_self', 'pending', 'staging-demo-user-4', now() - '10 minutes'::interval)
       ON CONFLICT (user_id_a, user_id_b) DO NOTHING`
    );
    await pool.query(
      `INSERT INTO messages (id, conversation_type, conversation_id, sender_user_id, sender_username, text, created_at)
       VALUES ('msg_staging_pending_1', 'direct', 'dm_staging_pending_1', 'staging-demo-user-4', 'staging-demo-citra',
               'Hi! I saw your profile and wanted to connect.', now() - '10 minutes'::interval)
       ON CONFLICT (id) DO NOTHING`
    );

    await pool.query(
      `INSERT INTO direct_conversations (id, user_id_a, user_id_b, status, requested_by_user_id, created_at)
       VALUES ('dm_staging_accepted_1', 'staging-demo-user-5', 'user_self', 'accepted', 'staging-demo-user-5', now() - '1 day'::interval)
       ON CONFLICT (user_id_a, user_id_b) DO NOTHING`
    );
    await pool.query(
      `INSERT INTO messages (id, conversation_type, conversation_id, sender_user_id, sender_username, text, created_at)
       VALUES ('msg_staging_accepted_1', 'direct', 'dm_staging_accepted_1', 'staging-demo-user-5', 'staging-demo-dedi',
               'Hey, thanks for accepting!', now() - '1 day'::interval)
       ON CONFLICT (id) DO NOTHING`
    );
    await pool.query(
      `INSERT INTO messages (id, conversation_type, conversation_id, sender_user_id, sender_username, text, created_at)
       VALUES ('msg_staging_accepted_2', 'direct', 'dm_staging_accepted_1', 'staging-demo-user-5', 'staging-demo-dedi',
               'Let me know if you want to grab a call sometime.', now() - '23 hours'::interval)
       ON CONFLICT (id) DO NOTHING`
    );
    await pool.query(
      `INSERT INTO messages (id, conversation_type, conversation_id, sender_user_id, sender_username, text, created_at)
       VALUES ('msg_staging_accepted_3', 'direct', 'dm_staging_accepted_1', 'staging-demo-user-5', 'staging-demo-dedi',
               'Here''s the doc I mentioned: https://example.com/staging-demo-doc', now() - '22 hours'::interval)
       ON CONFLICT (id) DO NOTHING`
    );
    await pool.query(
      `INSERT INTO messages (id, conversation_type, conversation_id, sender_user_id, sender_username, text, image_url, image_id, created_at)
       VALUES ('msg_staging_accepted_4', 'direct', 'dm_staging_accepted_1', 'staging-demo-user-5', 'staging-demo-dedi',
               'Staging demo photo', 'https://picsum.photos/seed/staging-demo-accepted-dm/400/300', 'staging-demo-image-accepted-dm',
               now() - '21 hours'::interval)
       ON CONFLICT (id) DO NOTHING`
    );

    // Untouched conversation with NO conversation_user_state row at all --
    // regression fixture for the unread-badge bug, where a conversation that
    // had never been opened (so last_read_at was never set) was silently
    // treated as fully read instead of fully unread.
    await pool.query(
      `INSERT INTO direct_conversations (id, user_id_a, user_id_b, status, requested_by_user_id, created_at)
       VALUES ('dm_staging_untouched_1', 'staging-demo-user-8', 'user_self', 'accepted', 'staging-demo-user-8', now() - '2 hours'::interval)
       ON CONFLICT (user_id_a, user_id_b) DO NOTHING`
    );
    await pool.query(
      `INSERT INTO messages (id, conversation_type, conversation_id, sender_user_id, sender_username, text, created_at)
       VALUES ('msg_staging_untouched_1', 'direct', 'dm_staging_untouched_1', 'staging-demo-user-8', 'staging-demo-gita',
               'Hey, are you around?', now() - '2 hours'::interval)
       ON CONFLICT (id) DO NOTHING`
    );
    await pool.query(
      `INSERT INTO messages (id, conversation_type, conversation_id, sender_user_id, sender_username, text, created_at)
       VALUES ('msg_staging_untouched_2', 'direct', 'dm_staging_untouched_1', 'staging-demo-user-8', 'staging-demo-gita',
               'Following up on this -- let me know when you get a chance.', now() - '1 hour'::interval)
       ON CONFLICT (id) DO NOTHING`
    );
    await pool.query(
      `INSERT INTO messages (id, conversation_type, conversation_id, sender_user_id, sender_username, text, created_at)
       VALUES ('msg_staging_untouched_3', 'direct', 'dm_staging_untouched_1', 'staging-demo-user-8', 'staging-demo-gita',
               'No rush, just wanted to bump this to the top.', now() - '30 minutes'::interval)
       ON CONFLICT (id) DO NOTHING`
    );

    // 500+ message conversation -- regression fixture for listMessages()
    // paginating to the OLDEST 500 messages instead of the newest 500, which
    // made a long-running thread open scrolled to ancient history instead of
    // the actual latest messages.
    await pool.query(
      `INSERT INTO direct_conversations (id, user_id_a, user_id_b, status, requested_by_user_id, created_at)
       VALUES ('dm_staging_long_1', 'staging-demo-user-9', 'user_self', 'accepted', 'staging-demo-user-9', now() - '10 days'::interval)
       ON CONFLICT (user_id_a, user_id_b) DO NOTHING`
    );
    const longThreadCount = await pool.query(
      `SELECT count(*)::int AS count FROM messages WHERE conversation_type = 'direct' AND conversation_id = 'dm_staging_long_1'`
    );
    if (longThreadCount.rows[0].count === 0) {
      await pool.query(
        `INSERT INTO messages (id, conversation_type, conversation_id, sender_user_id, sender_username, text, created_at)
         SELECT 'msg_staging_long_' || n,
                'direct', 'dm_staging_long_1', 'staging-demo-user-9', 'staging-demo-hasan',
                'Staging demo long-thread message #' || n,
                now() - ((510 - n) || ' minutes')::interval
           FROM generate_series(1, 510) AS n
         ON CONFLICT (id) DO NOTHING`
      );
      await pool.query(
        `INSERT INTO messages (id, conversation_type, conversation_id, sender_user_id, sender_username, text, created_at)
         VALUES ('msg_staging_long_newest', 'direct', 'dm_staging_long_1', 'staging-demo-user-9', 'staging-demo-hasan',
                 'This is the newest message in the long thread.', now())
         ON CONFLICT (id) DO NOTHING`
      );
    }

    // Dedicated send target for SHOT_REPLY_LEAK (cross-conversation reply
    // leak regression check) -- deliberately its own fixture, not reused
    // from the untouched/long-thread conversations above, so sending into
    // it can't disturb those tests' preconditions.
    await pool.query(
      `INSERT INTO direct_conversations (id, user_id_a, user_id_b, status, requested_by_user_id, created_at)
       VALUES ('dm_staging_reply_leak_1', 'staging-demo-user-12', 'user_self', 'accepted', 'staging-demo-user-12', now() - '3 hours'::interval)
       ON CONFLICT (user_id_a, user_id_b) DO NOTHING`
    );
    await pool.query(
      `INSERT INTO messages (id, conversation_type, conversation_id, sender_user_id, sender_username, text, created_at)
       VALUES ('msg_staging_reply_leak_1', 'direct', 'dm_staging_reply_leak_1', 'staging-demo-user-12', 'staging-demo-ivan',
               'This thread is unrelated to whatever you were replying to elsewhere.', now() - '3 hours'::interval)
       ON CONFLICT (id) DO NOTHING`
    );

    // Mixed-direction thread -- a received message followed by a sent
    // ('user_self') message as the newest one. Regression fixture for the
    // Messages-list bug report ("sent and received DMs don't show up in the
    // list"): the list preview must reflect the SENT message here, not just
    // ever show received ones, and the thread must render both directions.
    await pool.query(
      `INSERT INTO direct_conversations (id, user_id_a, user_id_b, status, requested_by_user_id, created_at)
       VALUES ('dm_staging_mixed_1', 'staging-demo-user-13', 'user_self', 'accepted', 'staging-demo-user-13', now() - '45 minutes'::interval)
       ON CONFLICT (user_id_a, user_id_b) DO NOTHING`
    );
    await pool.query(
      `INSERT INTO messages (id, conversation_type, conversation_id, sender_user_id, sender_username, text, created_at)
       VALUES ('msg_staging_mixed_received', 'direct', 'dm_staging_mixed_1', 'staging-demo-user-13', 'staging-demo-joko',
               'Shot mixed check: received message', now() - '40 minutes'::interval)
       ON CONFLICT (id) DO NOTHING`
    );

    console.log('Staging demo direct conversations seeded');
  } catch (err) {
    console.error('Staging direct conversation seed error:', err);
  }
}

// Start server. initDatabase() (schema + staging seeds) must finish BEFORE
// the socket starts accepting connections -- app.listen()'s own callback
// firing after bind is too late, since Express can already be routing
// requests to handlers (including GET /api/state's staging seed calls)
// while that callback's async body is still running. On a genuinely cold
// container, the checks harness's very first request could land mid-init:
// tables not yet created, or a staging seed row not yet inserted, silently
// breaking a lookup like the INNER JOIN in GET /api/direct-conversations
// and making a seeded row invisible even though it's fine moments later.
let server;
(async () => {
  try {
    await initDatabase();
  } catch (err) {
    console.error('Database schema unavailable — group endpoints will fail.');
  }
  server = app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
})();

// Graceful shutdown: the platform SIGTERMs the container on every deploy and
// gives it a few seconds before SIGKILL.
const DRAIN_MS = 3000;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] ${signal} received, draining`);
  server?.close(() => {});
  server?.closeIdleConnections?.();
  const t = setTimeout(() => server?.closeAllConnections?.(), DRAIN_MS);
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
