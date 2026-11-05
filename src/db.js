'use strict';
/**
 * Lớp lưu trữ dữ liệu.
 * - Có DATABASE_URL  -> dùng PostgreSQL (dữ liệu bền vững).
 * - Không có         -> chạy tạm trong bộ nhớ (mất khi khởi động lại) + hiện cảnh báo vàng.
 * Nguyên tắc: chỉ TẠO bảng nếu chưa có, không bao giờ xóa/sửa phá hủy dữ liệu thật.
 */
const crypto = require('crypto');

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS settings (
     key         TEXT PRIMARY KEY,
     value       TEXT NOT NULL,
     updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,
  `CREATE TABLE IF NOT EXISTS users (
     id             SERIAL PRIMARY KEY,
     username       TEXT NOT NULL UNIQUE,
     full_name      TEXT NOT NULL,
     password_hash  TEXT NOT NULL,
     role           TEXT NOT NULL DEFAULT 'user',
     is_active      BOOLEAN NOT NULL DEFAULT TRUE,
     created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     last_login_at  TIMESTAMPTZ
   )`,
  `CREATE TABLE IF NOT EXISTS sessions (
     token_hash  TEXT PRIMARY KEY,
     user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     expires_at  TIMESTAMPTZ NOT NULL,
     created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)`,
];

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

/* ---------------- PostgreSQL ---------------- */
function createPgStore(url) {
  const { Pool } = require('pg');
  const needSsl = /sslmode=require/i.test(url) || process.env.PGSSL === 'true';
  const pool = new Pool({
    connectionString: url,
    ssl: needSsl ? { rejectUnauthorized: false } : undefined,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 8000,
  });
  pool.on('error', (err) => console.error('[db] Lỗi kết nối nền:', err.message));

  let healthy = false;

  return {
    mode: 'postgres',
    isHealthy: () => healthy,

    async init() {
      // thử kết nối tối đa 5 lần (DB trên Railway có thể khởi động chậm hơn web)
      let lastErr;
      for (let i = 1; i <= 5; i++) {
        try {
          const client = await pool.connect();
          try {
            for (const sql of MIGRATIONS) await client.query(sql);
          } finally {
            client.release();
          }
          healthy = true;
          return;
        } catch (e) {
          lastErr = e;
          console.error(`[db] Kết nối lần ${i} thất bại: ${e.message}`);
          await new Promise((r) => setTimeout(r, 2000 * i));
        }
      }
      healthy = false;
      throw lastErr;
    },

    async ping() {
      try {
        await pool.query('SELECT 1');
        healthy = true;
      } catch (e) {
        healthy = false;
      }
      return healthy;
    },

    async getSettings() {
      const { rows } = await pool.query('SELECT key, value FROM settings');
      return Object.fromEntries(rows.map((r) => [r.key, r.value]));
    },

    /** Khởi tạo lần đầu trong 1 giao dịch, có khóa để 2 người bấm cùng lúc không tạo trùng */
    async completeSetup({ settings, admin }) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(424242)');
        const done = await client.query("SELECT 1 FROM settings WHERE key = 'setup_done'");
        if (done.rowCount > 0) {
          await client.query('ROLLBACK');
          return { ok: false, reason: 'already' };
        }
        for (const [k, v] of Object.entries(settings)) {
          await client.query(
            `INSERT INTO settings(key, value) VALUES ($1, $2)
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
            [k, v]
          );
        }
        await client.query(
          `INSERT INTO users(username, full_name, password_hash, role) VALUES ($1, $2, $3, 'admin')`,
          [admin.username, admin.full_name, admin.password_hash]
        );
        await client.query(
          `INSERT INTO settings(key, value) VALUES ('setup_done', $1)`,
          [new Date().toISOString()]
        );
        await client.query('COMMIT');
        return { ok: true };
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    },

    async findUserByUsername(username) {
      const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
      return rows[0] || null;
    },

    async touchLogin(userId) {
      await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [userId]);
    },

    async createSession(token, userId, expiresAt) {
      await pool.query(
        'INSERT INTO sessions(token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
        [sha256(token), userId, expiresAt]
      );
    },

    async getSessionUser(token) {
      const { rows } = await pool.query(
        `SELECT u.id, u.username, u.full_name, u.role, u.is_active
           FROM sessions s JOIN users u ON u.id = s.user_id
          WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
        [sha256(token)]
      );
      const u = rows[0];
      return u && u.is_active ? u : null;
    },

    async deleteSession(token) {
      await pool.query('DELETE FROM sessions WHERE token_hash = $1', [sha256(token)]);
    },

    async purgeExpiredSessions() {
      await pool.query('DELETE FROM sessions WHERE expires_at <= NOW()');
    },
  };
}

/* ---------------- Bộ nhớ tạm (chưa nối kho dữ liệu) ---------------- */
function createMemoryStore() {
  const settings = {};
  const users = [];
  const sessions = new Map();
  let nextId = 1;

  return {
    mode: 'memory',
    isHealthy: () => true,
    async init() {},
    async ping() { return true; },
    async getSettings() { return { ...settings }; },

    async completeSetup({ settings: s, admin }) {
      if (settings.setup_done) return { ok: false, reason: 'already' };
      Object.assign(settings, s);
      users.push({
        id: nextId++, username: admin.username, full_name: admin.full_name,
        password_hash: admin.password_hash, role: 'admin', is_active: true,
        created_at: new Date(), last_login_at: null,
      });
      settings.setup_done = new Date().toISOString();
      return { ok: true };
    },

    async findUserByUsername(username) {
      return users.find((u) => u.username === username) || null;
    },
    async touchLogin(userId) {
      const u = users.find((x) => x.id === userId);
      if (u) u.last_login_at = new Date();
    },
    async createSession(token, userId, expiresAt) {
      sessions.set(sha256(token), { userId, expiresAt });
    },
    async getSessionUser(token) {
      const s = sessions.get(sha256(token));
      if (!s || s.expiresAt <= new Date()) return null;
      const u = users.find((x) => x.id === s.userId);
      return u && u.is_active
        ? { id: u.id, username: u.username, full_name: u.full_name, role: u.role }
        : null;
    },
    async deleteSession(token) { sessions.delete(sha256(token)); },
    async purgeExpiredSessions() {
      const now = new Date();
      for (const [k, s] of sessions) if (s.expiresAt <= now) sessions.delete(k);
    },
  };
}

function createStore() {
  const url = (process.env.DATABASE_URL || '').trim();
  return url ? createPgStore(url) : createMemoryStore();
}

module.exports = { createStore };
