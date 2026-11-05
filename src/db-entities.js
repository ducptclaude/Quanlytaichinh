'use strict';
/**
 * Lưu trữ cho các danh mục (Dự án, Doanh thu, Chi phí) – cấu hình ở src/entities.js
 * Lỗi nghiệp vụ (err.code): 'duplicate' (trùng mã), 'in_use' (đang được dùng ở danh mục khác),
 *                           'ref_missing' (dự án được chọn không còn), 'not_found'
 */
const { ENTITIES, ORDER, LEGACY_REFS } = require('./entities');

const bizError = (code, extra) => Object.assign(new Error(code), { code }, extra);
const SQL_TYPE = { text: 'TEXT', textarea: 'TEXT', select: 'TEXT', money: 'BIGINT', date: 'DATE', ref: 'INTEGER' };

/** Các danh mục đang tham chiếu tới danh mục `key` */
function referrers(key) {
  const out = [];
  for (const k of ORDER) {
    for (const f of ENTITIES[k].fields) if (f.type === 'ref' && f.ref === key) out.push({ key: k, table: ENTITIES[k].table, field: f.name });
  }
  return out;
}

/** Câu lệnh tạo bảng/thêm cột/bổ sung dữ liệu cũ – chỉ THÊM, không xóa */
function entityMigrations() {
  const sql = [];
  for (const key of ORDER) {
    const e = ENTITIES[key];
    sql.push(`CREATE TABLE IF NOT EXISTS ${e.table} (
      id               SERIAL PRIMARY KEY,
      code             TEXT NOT NULL,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by       INTEGER,
      created_by_name  TEXT,
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by       INTEGER,
      updated_by_name  TEXT
    )`);
    sql.push(`CREATE UNIQUE INDEX IF NOT EXISTS ${e.table}_code_uq ON ${e.table} (LOWER(code))`);
    for (const f of e.fields) {
      const ref = f.type === 'ref' ? ` REFERENCES ${ENTITIES[f.ref].table}(id) ON DELETE RESTRICT` : '';
      sql.push(`ALTER TABLE ${e.table} ADD COLUMN IF NOT EXISTS ${f.name} ${SQL_TYPE[f.type]}${ref}`);
      if (f.type === 'ref') sql.push(`CREATE INDEX IF NOT EXISTS ${e.table}_${f.name}_idx ON ${e.table}(${f.name})`);
    }
    if (e.migrate) sql.push(...e.migrate);
  }
  return sql;
}

const cols = (key) => ['code', ...ENTITIES[key].fields.map((f) => f.name)];

/* ================= PostgreSQL ================= */
function pgEntities(pool) {
  const mapErr = (e) => {
    if (e.code === '23505') return bizError('duplicate');
    if (e.code === '23503') return bizError(/update or delete/.test(e.message) ? 'in_use' : 'ref_missing');
    return e;
  };
  return {
    entityMigrations,

    async listRecords(key) {
      const { rows } = await pool.query(`SELECT * FROM ${ENTITIES[key].table} ORDER BY id`);
      return rows;
    },
    async getRecord(key, id) {
      const { rows } = await pool.query(`SELECT * FROM ${ENTITIES[key].table} WHERE id = $1`, [id]);
      return rows[0] || null;
    },
    async createRecord(key, data, user) {
      const c = cols(key);
      const vals = c.map((k) => data[k] ?? null);
      try {
        const { rows } = await pool.query(
          `INSERT INTO ${ENTITIES[key].table} (${c.join(', ')}, created_by, created_by_name, updated_by, updated_by_name)
           VALUES (${c.map((_, i) => `$${i + 1}`).join(', ')}, $${c.length + 1}, $${c.length + 2}, $${c.length + 1}, $${c.length + 2})
           RETURNING id`,
          [...vals, user.id, user.full_name]
        );
        return rows[0].id;
      } catch (e) { throw mapErr(e); }
    },
    async updateRecord(key, id, data, user) {
      const c = cols(key);
      try {
        const r = await pool.query(
          `UPDATE ${ENTITIES[key].table}
              SET ${c.map((k, i) => `${k} = $${i + 2}`).join(', ')},
                  updated_at = NOW(), updated_by = $${c.length + 2}, updated_by_name = $${c.length + 3}
            WHERE id = $1`,
          [id, ...c.map((k) => data[k] ?? null), user.id, user.full_name]
        );
        if (r.rowCount === 0) throw bizError('not_found');
      } catch (e) { throw mapErr(e); }
    },
    async countRefs(key, id) {
      const out = [];
      for (const r of referrers(key)) {
        const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM ${r.table} WHERE ${r.field} = $1`, [id]);
        if (rows[0].n > 0) out.push({ single: ENTITIES[r.key].single, n: rows[0].n });
      }
      // Dữ liệu cũ của tab đã bỏ (chỉ đếm nếu bảng còn tồn tại)
      for (const l of LEGACY_REFS.filter((x) => x.parent === key)) {
        const ex = await pool.query('SELECT to_regclass($1) AS t', [l.table]);
        if (!ex.rows[0].t) continue;
        const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM ${l.table} WHERE ${l.field} = $1`, [id]);
        if (rows[0].n > 0) out.push({ single: l.single, n: rows[0].n, legacy: true });
      }
      return out;
    },
    async deleteRecord(key, id) {
      try {
        const r = await pool.query(`DELETE FROM ${ENTITIES[key].table} WHERE id = $1`, [id]);
        if (r.rowCount === 0) throw bizError('not_found');
      } catch (e) { throw mapErr(e); }
    },
  };
}

/* ================= Bộ nhớ tạm ================= */
function memoryEntities() {
  const data = Object.fromEntries(ORDER.map((k) => [k, []]));
  const seq = Object.fromEntries(ORDER.map((k) => [k, 1]));
  const dupCode = (key, code, exceptId) =>
    data[key].some((r) => r.id !== exceptId && String(r.code).toLowerCase() === String(code).toLowerCase());
  const checkRefs = (key, rec) => {
    for (const f of ENTITIES[key].fields) {
      if (f.type === 'ref' && rec[f.name] != null && !data[f.ref].some((r) => r.id === rec[f.name])) {
        throw bizError('ref_missing');
      }
    }
  };
  const pick = (key, src) => Object.fromEntries(cols(key).map((k) => [k, src[k] ?? null]));

  return {
    entityMigrations: () => [],
    async listRecords(key) { return data[key].map((r) => ({ ...r })); },
    async getRecord(key, id) {
      const r = data[key].find((x) => x.id === id);
      return r ? { ...r } : null;
    },
    async createRecord(key, rec, user) {
      if (dupCode(key, rec.code)) throw bizError('duplicate');
      checkRefs(key, rec);
      const now = new Date();
      const row = {
        id: seq[key]++, ...pick(key, rec), created_at: now, created_by: user.id, created_by_name: user.full_name,
        updated_at: now, updated_by: user.id, updated_by_name: user.full_name,
      };
      data[key].push(row);
      return row.id;
    },
    async updateRecord(key, id, rec, user) {
      const row = data[key].find((x) => x.id === id);
      if (!row) throw bizError('not_found');
      if (dupCode(key, rec.code, id)) throw bizError('duplicate');
      checkRefs(key, rec);
      Object.assign(row, pick(key, rec), { updated_at: new Date(), updated_by: user.id, updated_by_name: user.full_name });
    },
    async countRefs(key, id) {
      return referrers(key)
        .map((r) => ({ single: ENTITIES[r.key].single, n: data[r.key].filter((x) => x[r.field] === id).length }))
        .filter((x) => x.n > 0);
    },
    async deleteRecord(key, id) {
      const i = data[key].findIndex((x) => x.id === id);
      if (i < 0) throw bizError('not_found');
      if ((await this.countRefs(key, id)).length) throw bizError('in_use');
      data[key].splice(i, 1);
    },
  };
}

module.exports = { pgEntities, memoryEntities, entityMigrations };
