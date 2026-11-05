'use strict';
/** Số phiên bản hiển thị (đọc từ version.json, do scripts/bump-version.js cập nhật) */
let version = 'V0';
try { version = require('../version.json').version || version; } catch (_) { /* giữ mặc định */ }
module.exports = { version };
