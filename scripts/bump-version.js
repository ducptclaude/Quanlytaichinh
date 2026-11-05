'use strict';
/**
 * Tăng số phiên bản dạng V[lần trong ngày].[ngày].[tháng].[năm] (giờ Việt Nam).
 * Chạy:  npm run bump
 * - Cùng ngày với lần trước -> tăng "lần trong ngày"
 * - Sang ngày mới          -> bắt đầu lại từ 1
 */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'version.json');
let cur = { date: '', count: 0 };
try { cur = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { /* lần đầu */ }

const parts = Object.fromEntries(
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date()).map((p) => [p.type, p.value])
);
const today = `${parts.year}-${parts.month}-${parts.day}`;
const count = cur.date === today ? (Number(cur.count) || 0) + 1 : 1;
const next = { version: `V${count}.${parts.day}.${parts.month}.${parts.year}`, date: today, count };

fs.writeFileSync(file, JSON.stringify(next, null, 2) + '\n');
console.log(`Phiên bản: ${cur.version || '(chưa có)'}  ->  ${next.version}`);
