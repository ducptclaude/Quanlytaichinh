'use strict';
/**
 * Lưu trữ cho các danh mục (Dự án, Doanh thu, Chi phí) – cấu hình ở src/entities.js
 * Lỗi nghiệp vụ (err.code): 'duplicate' (trùng mã), 'in_use' (đang được dùng ở danh mục khác),
 *                           'ref_missing' (dự án được chọn không còn), 'not_found'
 */
const { ENTITIES, ORDER, DAILY } = require('./entities');

const bizError = (code, extra) => Object.assign(new Error(code), { code }, extra);
const SQL_TYPE = { text: 'TEXT', textarea: 'TEXT', select: 'TEXT', money: 'BIGINT', date: 'DATE', ref: 'INTEGER' };

/** Các danh mục đang tham chiếu tới danh mục `key` */
function referrers(key) {
  const out = [];
  for (const k of ORDER) {
    for (const f of ENTITIES[k].fields) if (f.type === 'ref' && f.ref === key) out.push({ key: k, field: f.name });
  }
  if (DAILY.parent === key) out.push({ key: 'daily', field: 'project_id' });
  return out;
}

/** Câu lệnh tạo bảng/thêm cột – chỉ THÊM, không xóa */
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
  }
  return [...sql, ...dailyMigrations()];
}

const tableOf = (key) => (key === 'daily' ? DAILY.table : ENTITIES[key].table);
const DAILY_COLS = ['project_id', 'entry_date', 'doc_no', 'content', 'unit', 'quantity', 'unit_price', 'amount', 'note'];

function dailyMigrations() {
  return [
    `CREATE TABLE IF NOT EXISTS ${DAILY.table} (
      id               SERIAL PRIMARY KEY,
      project_id       INTEGER NOT NULL REFERENCES ${ENTITIES[DAILY.parent].table}(id) ON DELETE RESTRICT,
      entry_date       DATE NOT NULL,
      doc_no           TEXT,
      content          TEXT NOT NULL,
      unit             TEXT,
      quantity         NUMERIC(18,3) NOT NULL,
      unit_price       BIGINT NOT NULL,
      amount           BIGINT NOT NULL,
      note             TEXT,
      version          INTEGER NOT NULL DEFAULT 1,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by       INTEGER,
      created_by_name  TEXT,
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by       INTEGER,
      updated_by_name  TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS ${DAILY.table}_project_date_idx ON ${DAILY.table}(project_id, entry_date)`,
  ];
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
        const { rows } = await pool.query(
          `SELECT COUNT(*)::int AS n FROM ${tableOf(r.key)} WHERE ${r.field} = $1`, [id]
        );
        if (rows[0].n > 0) out.push({ key: r.key, n: rows[0].n });
      }
      return out;
    },
    async deleteRecord(key, id) {
      try {
        const r = await pool.query(`DELETE FROM ${ENTITIES[key].table} WHERE id = $1`, [id]);
        if (r.rowCount === 0) throw bizError('not_found');
      } catch (e) { throw mapErr(e); }
    },

    /* ----- Nhập hằng ngày ----- */
    async listDaily(projectId, { from, to } = {}) {
      const { rows } = await pool.query(
        `SELECT * FROM ${DAILY.table}
          WHERE project_id = $1 AND ($2::date IS NULL OR entry_date >= $2) AND ($3::date IS NULL OR entry_date <= $3)
          ORDER BY entry_date, id`,
        [projectId, from || null, to || null]
      );
      return rows;
    },
    async getDaily(id) {
      const { rows } = await pool.query(`SELECT * FROM ${DAILY.table} WHERE id = $1`, [id]);
      return rows[0] || null;
    },
    async createDaily(d, user) {
      try {
        const { rows } = await pool.query(
          `INSERT INTO ${DAILY.table} (${DAILY_COLS.join(', ')}, created_by, created_by_name, updated_by, updated_by_name)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$10,$11) RETURNING *`,
          [...DAILY_COLS.map((k) => d[k] ?? null), user.id, user.full_name]
        );
        return rows[0];
      } catch (e) { throw mapErr(e); }
    },
    /** Sửa có kiểm tra phiên bản: nếu người khác vừa sửa dòng này -> lỗi 'conflict' */
    async updateDaily(id, version, d, user) {
      let rows;
      try {
        ({ rows } = await pool.query(
          `UPDATE ${DAILY.table} SET ${DAILY_COLS.map((k, i) => `${k} = $${i + 3}`).join(', ')},
                  version = version + 1, updated_at = NOW(), updated_by = $${DAILY_COLS.length + 3}, updated_by_name = $${DAILY_COLS.length + 4}
            WHERE id = $1 AND version = $2 RETURNING *`,
          [id, version, ...DAILY_COLS.map((k) => d[k] ?? null), user.id, user.full_name]
        ));
      } catch (e) { throw mapErr(e); }
      if (rows[0]) return rows[0];
      const cur = await this.getDaily(id);
      throw bizError(cur ? 'conflict' : 'not_found', { current: cur });
    },
    async deleteDaily(id) {
      const r = await pool.query(`DELETE FROM ${DAILY.table} WHERE id = $1`, [id]);
      if (r.rowCount === 0) throw bizError('not_found');
    },
    /** Gợi ý khi gõ: nội dung đã từng nhập (mọi dự án), kèm ĐVT và đơn giá gần nhất */
    async dailySuggestions(limit = 300) {
      const { rows } = await pool.query(
        `SELECT content,
                (ARRAY_AGG(unit ORDER BY updated_at DESC))[1] AS unit,
                (ARRAY_AGG(unit_price ORDER BY updated_at DESC))[1] AS unit_price,
                COUNT(*)::int AS n
           FROM ${DAILY.table} GROUP BY content ORDER BY n DESC, MAX(updated_at) DESC LIMIT $1`, [limit]
      );
      return rows;
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
  const daily = [];
  let dailySeq = 1;
  data.daily = daily; // để countRefs đếm được
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
        .map((r) => ({ key: r.key, n: data[r.key].filter((x) => x[r.field] === id).length }))
        .filter((x) => x.n > 0);
    },
    async deleteRecord(key, id) {
      const i = data[key].findIndex((x) => x.id === id);
      if (i < 0) throw bizError('not_found');
      if ((await this.countRefs(key, id)).length) throw bizError('in_use');
      data[key].splice(i, 1);
    },

    /* ----- Nhập hằng ngày ----- */
    async listDaily(projectId, { from, to } = {}) {
      return daily
        .filter((x) => x.project_id === projectId && (!from || x.entry_date >= from) && (!to || x.entry_date <= to))
        .sort((a, b) => (a.entry_date < b.entry_date ? -1 : a.entry_date > b.entry_date ? 1 : a.id - b.id))
        .map((x) => ({ ...x }));
    },
    async getDaily(id) {
      const x = daily.find((r) => r.id === id);
      return x ? { ...x } : null;
    },
    async createDaily(d, user) {
      if (!data.projects.some((p) => p.id === d.project_id)) throw bizError('ref_missing');
      const now = new Date();
      const row = {
        id: dailySeq++, ...Object.fromEntries(DAILY_COLS.map((k) => [k, d[k] ?? null])), version: 1,
        created_at: now, created_by: user.id, created_by_name: user.full_name,
        updated_at: now, updated_by: user.id, updated_by_name: user.full_name,
      };
      daily.push(row);
      return { ...row };
    },
    async updateDaily(id, version, d, user) {
      const row = daily.find((r) => r.id === id);
      if (!row) throw bizError('not_found');
      if (row.version !== version) throw bizError('conflict', { current: { ...row } });
      if (!data.projects.some((p) => p.id === d.project_id)) throw bizError('ref_missing');
      Object.assign(row, Object.fromEntries(DAILY_COLS.map((k) => [k, d[k] ?? null])), {
        version: row.version + 1, updated_at: new Date(), updated_by: user.id, updated_by_name: user.full_name,
      });
      return { ...row };
    },
    async deleteDaily(id) {
      const i = daily.findIndex((r) => r.id === id);
      if (i < 0) throw bizError('not_found');
      daily.splice(i, 1);
    },
    async dailySuggestions(limit = 300) {
      const m = new Map();
      for (const r of [...daily].sort((a, b) => b.updated_at - a.updated_at)) {
        const cur = m.get(r.content);
        if (cur) cur.n++;
        else m.set(r.content, { content: r.content, unit: r.unit, unit_price: r.unit_price, n: 1 });
      }
      return [...m.values()].sort((a, b) => b.n - a.n).slice(0, limit);
    },
  };
}

module.exports = { pgEntities, memoryEntities, entityMigrations };
