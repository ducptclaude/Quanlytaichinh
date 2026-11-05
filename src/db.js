'use strict';
/**
 * Lớp lưu trữ dữ liệu.
 * - Có DATABASE_URL  -> dùng PostgreSQL (dữ liệu bền vững).
 * - Không có         -> chạy tạm trong bộ nhớ (mất khi khởi động lại) + hiện cảnh báo vàng.
 * Nguyên tắc: chỉ TẠO bảng / THÊM cột nếu chưa có, không bao giờ xóa/sửa phá hủy dữ liệu thật.
 *
 * Lỗi nghiệp vụ được ném ra với err.code:
 *   'duplicate'  – trùng tên đăng nhập
 *   'last_admin' – thao tác làm hệ thống không còn Quản trị nào đang hoạt động
 *   'not_found'  – không tìm thấy tài khoản
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
  // v2: bắt buộc đổi mật khẩu sau khi Quản trị đặt lại
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ`,
];

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const bizError = (code) => Object.assign(new Error(code), { code });
const USER_FIELDS = ['full_name', 'role', 'is_active'];
const PUBLIC_COLS = 'id, username, full_name, role, is_active, must_change_password, created_at, last_login_at';
const ADMIN_LOCK = 424243;

/* ================= PostgreSQL ================= */
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

  /** Chạy thay đổi tài khoản trong giao dịch; nếu sau đó không còn Quản trị hoạt động -> hủy */
  async function withAdminGuard(fn) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1)', [ADMIN_LOCK]);
      const result = await fn(client);
      const { rows } = await client.query(
        "SELECT COUNT(*)::int AS n FROM users WHERE role = 'admin' AND is_active = TRUE"
      );
      if (rows[0].n < 1) throw bizError('last_admin');
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }

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

    /* ---------- Cấu hình ---------- */
    async getSettings() {
      const { rows } = await pool.query('SELECT key, value FROM settings');
      return Object.fromEntries(rows.map((r) => [r.key, r.value]));
    },

    async setSettings(obj) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const [k, v] of Object.entries(obj)) {
          await client.query(
            `INSERT INTO settings(key, value) VALUES ($1, $2)
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
            [k, String(v)]
          );
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
      } finally {
        client.release();
      }
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

    /* ---------- Tài khoản ---------- */
    async findUserByUsername(username) {
      const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
      return rows[0] || null;
    },

    async getUser(id) {
      const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
      return rows[0] || null;
    },

    async listUsers() {
      const { rows } = await pool.query(`SELECT ${PUBLIC_COLS} FROM users ORDER BY id`);
      return rows;
    },

    async createUser({ username, full_name, password_hash, role, must_change_password }) {
      try {
        const { rows } = await pool.query(
          `INSERT INTO users(username, full_name, password_hash, role, must_change_password)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [username, full_name, password_hash, role, Boolean(must_change_password)]
        );
        return rows[0].id;
      } catch (e) {
        if (e.code === '23505') throw bizError('duplicate');
        throw e;
      }
    },

    async updateUser(id, fields) {
      const keys = Object.keys(fields).filter((k) => USER_FIELDS.includes(k));
      if (!keys.length) return;
      await withAdminGuard(async (c) => {
        const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
        const r = await c.query(
          `UPDATE users SET ${sets}, updated_at = NOW() WHERE id = $1`,
          [id, ...keys.map((k) => fields[k])]
        );
        if (r.rowCount === 0) throw bizError('not_found');
        if (fields.is_active === false) await c.query('DELETE FROM sessions WHERE user_id = $1', [id]);
      });
    },

    async deleteUser(id) {
      await withAdminGuard(async (c) => {
        const r = await c.query('DELETE FROM users WHERE id = $1', [id]);
        if (r.rowCount === 0) throw bizError('not_found');
      });
    },

    /** Đặt mật khẩu mới; đăng xuất mọi phiên của người đó (trừ phiên keepToken nếu có) */
    async setPassword(id, password_hash, { mustChange = false, keepToken = null } = {}) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const r = await client.query(
          `UPDATE users SET password_hash = $2, must_change_password = $3, updated_at = NOW() WHERE id = $1`,
          [id, password_hash, mustChange]
        );
        if (r.rowCount === 0) throw bizError('not_found');
        await client.query(
          'DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2',
          [id, keepToken ? sha256(keepToken) : '']
        );
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    },

    async touchLogin(userId) {
      await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [userId]);
    },

    /* ---------- Phiên đăng nhập ---------- */
    async createSession(token, userId, expiresAt) {
      await pool.query(
        'INSERT INTO sessions(token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
        [sha256(token), userId, expiresAt]
      );
    },

    async getSessionUser(token) {
      const { rows } = await pool.query(
        `SELECT u.id, u.username, u.full_name, u.role, u.is_active, u.must_change_password
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

/* ================= Bộ nhớ tạm (chưa nối kho dữ liệu) ================= */
function createMemoryStore() {
  const settings = {};
  let users = [];
  const sessions = new Map();
  let nextId = 1;

  const pub = (u) => u && ({
    id: u.id, username: u.username, full_name: u.full_name, role: u.role,
    is_active: u.is_active, must_change_password: u.must_change_password,
    created_at: u.created_at, last_login_at: u.last_login_at,
  });
  const activeAdmins = (list) => list.filter((u) => u.role === 'admin' && u.is_active).length;
  const dropSessions = (userId, keepHash = null) => {
    for (const [k, s] of sessions) if (s.userId === userId && k !== keepHash) sessions.delete(k);
  };

  return {
    mode: 'memory',
    isHealthy: () => true,
    async init() {},
    async ping() { return true; },

    async getSettings() { return { ...settings }; },
    async setSettings(obj) {
      for (const [k, v] of Object.entries(obj)) settings[k] = String(v);
    },

    async completeSetup({ settings: s, admin }) {
      if (settings.setup_done) return { ok: false, reason: 'already' };
      Object.assign(settings, s);
      users.push({
        id: nextId++, username: admin.username, full_name: admin.full_name,
        password_hash: admin.password_hash, role: 'admin', is_active: true,
        must_change_password: false, created_at: new Date(), last_login_at: null,
      });
      settings.setup_done = new Date().toISOString();
      return { ok: true };
    },

    async findUserByUsername(username) {
      return users.find((u) => u.username === username) || null;
    },
    async getUser(id) {
      return users.find((u) => u.id === id) || null;
    },
    async listUsers() {
      return users.map(pub);
    },
    async createUser({ username, full_name, password_hash, role, must_change_password }) {
      if (users.some((u) => u.username === username)) throw bizError('duplicate');
      const u = {
        id: nextId++, username, full_name, password_hash, role, is_active: true,
        must_change_password: Boolean(must_change_password), created_at: new Date(), last_login_at: null,
      };
      users.push(u);
      return u.id;
    },
    async updateUser(id, fields) {
      const u = users.find((x) => x.id === id);
      if (!u) throw bizError('not_found');
      const next = { ...u };
      for (const k of USER_FIELDS) if (k in fields) next[k] = fields[k];
      const after = users.map((x) => (x.id === id ? next : x));
      if (activeAdmins(after) < 1) throw bizError('last_admin');
      users = after;
      if (fields.is_active === false) dropSessions(id);
    },
    async deleteUser(id) {
      if (!users.some((x) => x.id === id)) throw bizError('not_found');
      const after = users.filter((x) => x.id !== id);
      if (activeAdmins(after) < 1) throw bizError('last_admin');
      users = after;
      dropSessions(id);
    },
    async setPassword(id, password_hash, { mustChange = false, keepToken = null } = {}) {
      const u = users.find((x) => x.id === id);
      if (!u) throw bizError('not_found');
      u.password_hash = password_hash;
      u.must_change_password = mustChange;
      dropSessions(id, keepToken ? sha256(keepToken) : null);
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
      return u && u.is_active ? pub(u) : null;
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
