'use strict';
/** Công cụ dùng chung cho bài thử: bật máy chủ riêng + trình duyệt giả lập có cookie */
const { spawn } = require('node:child_process');
const path = require('node:path');

/** Với PostgreSQL: mỗi máy chủ thử dùng 1 "ngăn" (schema) riêng, tạo mới và tự dọn – không đụng dữ liệu khác */
async function isolatedDbUrl() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return { url: '', cleanup: async () => {} };
  const { Client } = require('pg');
  const schema = `test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const c = new Client({ connectionString: url });
  await c.connect();
  await c.query(`CREATE SCHEMA ${schema}`);
  await c.end();
  const sep = url.includes('?') ? '&' : '?';
  return {
    url: `${url}${sep}options=${encodeURIComponent(`-c search_path=${schema}`)}`,
    cleanup: async () => {
      const d = new Client({ connectionString: url });
      await d.connect();
      await d.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); // chỉ xóa ngăn thử vừa tạo
      await d.end();
    },
  };
}

async function startServer(env = {}) {
  const db = await isolatedDbUrl();
  const port = 4000 + Math.floor(Math.random() * 900);
  const base = `http://127.0.0.1:${port}`;
  const proc = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(port), DATABASE_URL: db.url, APP_ENV: 'staging', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`${base}/health`)).ok) break; } catch (_) { /* chờ */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  function browser() {
    let cookie = '';
    async function req(method, url, form) {
      const res = await fetch(base + url, {
        method, redirect: 'manual',
        headers: { cookie, ...(form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}) },
        body: form ? new URLSearchParams(form).toString() : undefined,
      });
      const set = res.headers.get('set-cookie');
      if (set) { const m = set.match(/sid=([^;]*)/); if (m) cookie = m[1] ? `sid=${m[1]}` : ''; }
      const type = res.headers.get('content-type') || '';
      const body = type.includes('spreadsheet') ? Buffer.from(await res.arrayBuffer()) : await res.text();
      return { status: res.status, location: res.headers.get('location') || '', text: typeof body === 'string' ? body : '', body, type };
    }
    return { get: (u) => req('GET', u), post: (u, f) => req('POST', u, f) };
  }
  const stop = async () => {
    proc.kill();
    await new Promise((r) => setTimeout(r, 300));
    await db.cleanup().catch(() => {});
  };
  return { base, proc, browser, stop };
}

module.exports = { startServer, PW: 'Abcd@1234' };
