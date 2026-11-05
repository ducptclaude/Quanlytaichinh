'use strict';
/** Router có bắt lỗi cho hàm async (Express 4 không tự bắt) */
const express = require('express');

module.exports = function asyncRouter() {
  const r = express.Router();
  for (const m of ['get', 'post']) {
    const orig = r[m].bind(r);
    r[m] = (path, ...handlers) => orig(path, ...handlers.map((h) =>
      (req, res, next) => Promise.resolve(h(req, res, next)).catch(next)));
  }
  return r;
};
