// Vendored from usernode-dapp-starter. Do not hand-edit — fixes belong
// upstream and should be re-vendored into consumer apps.
//
// Maintains a directory of real Usernode users this app has seen (recorded
// from verified JWTs as they authenticate) so apps can suggest/search real
// platform accounts instead of shipping fake/mock user lists.

async function ensureUsernodeUsernamesSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usernode_users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      usernode_pubkey TEXT,
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function recordUsernodeUser(pool, user) {
  if (!user || !user.id || !user.username) return;
  await pool.query(
    `INSERT INTO usernode_users (id, username, usernode_pubkey, last_seen_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (id) DO UPDATE SET
       username = EXCLUDED.username,
       usernode_pubkey = EXCLUDED.usernode_pubkey,
       last_seen_at = NOW()`,
    [user.id, user.username, user.usernode_pubkey || null]
  );
}

async function getSuggestedUsernodeUsers(pool, { excludeUserId, limit = 20 } = {}) {
  const result = await pool.query(
    `SELECT id, username, usernode_pubkey FROM usernode_users
     WHERE id IS DISTINCT FROM $1
     ORDER BY last_seen_at DESC
     LIMIT $2`,
    [excludeUserId || null, limit]
  );
  return result.rows;
}

async function searchUsernodeUsernames(pool, { query, excludeUserId, limit = 20 } = {}) {
  const trimmed = (query || '').trim();
  if (!trimmed) return [];
  const result = await pool.query(
    `SELECT id, username, usernode_pubkey FROM usernode_users
     WHERE id IS DISTINCT FROM $1
       AND (username ILIKE '%' || $2 || '%' OR usernode_pubkey ILIKE '%' || $2 || '%')
     ORDER BY last_seen_at DESC
     LIMIT $3`,
    [excludeUserId || null, trimmed, limit]
  );
  return result.rows;
}

module.exports = {
  ensureUsernodeUsernamesSchema,
  recordUsernodeUser,
  getSuggestedUsernodeUsers,
  searchUsernodeUsernames
};
