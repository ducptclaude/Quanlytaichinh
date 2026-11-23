// BẢO VỆ MÃ GIAO DIỆN (chống sao chép công thức, cách làm của hệ thống)
//  1. Chỉ vài tệp cần cho trang Đăng nhập / Khởi tạo được tải khi CHƯA đăng nhập; mọi tệp mã khác bắt buộc đăng nhập.
//  2. Mã gửi xuống trình duyệt được rút gọn (xóa chú thích, khoảng trắng) và làm rối (đổi tên biến, mã hóa chuỗi chữ)
//     lúc máy chủ khởi động – mã gốc chỉ nằm trên máy chủ.
//  3. Nén sẵn (gzip / brotli) để tải nhanh; trình duyệt không lưu đệm lâu (mã mới có hiệu lực ngay khi cập nhật).
// Tắt làm rối khi cần gỡ lỗi: đặt biến môi trường BAO_VE_MA=0 (vẫn rút gọn + vẫn bắt buộc đăng nhập).
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const PUB = path.join(__dirname, '..', 'public');
// Tệp được tải khi chưa đăng nhập (trang Đăng nhập / Khởi tạo / báo lỗi CSDL)
const MO_CONG_KHAI = new Set(['/style.css', '/theme.js', '/i18n.js', '/i18n-en.js', '/common.js', '/login.js', '/setup.js']);
const laCongKhai = (p) => MO_CONG_KHAI.has(p) || p.startsWith('/img/');
// Tệp không làm rối: thư viện có sẵn (đã rút gọn, có giấy phép) và từ điển dịch (chỉ là dữ liệu chữ)
const KHONG_LAM_ROI = (rel) => rel.startsWith('vendor/') || rel === 'i18n-en.js';

const OBF_OPTS = {
  compact: true,
  target: 'browser',
  renameGlobals: false, // các tệp gọi hàm của nhau qua tên chung -> giữ tên toàn cục
  identifierNamesGenerator: 'hexadecimal',
  stringArray: true,
  stringArrayThreshold: 0.75,
  stringArrayEncoding: ['base64'],
  stringArrayRotate: true,
  stringArrayShuffle: true,
  splitStrings: false,
  controlFlowFlattening: false, // tắt để không làm chậm báo cáo
  deadCodeInjection: false,
  selfDefending: false,
  simplify: true,
  transformObjectKeys: false,
  unicodeEscapeSequence: false,
};

const kho = new Map(); // '/app.js' -> { type, raw, gz, br, etag }
let thongKe = null;

function dongGoi(rel, code, type) {
  const raw = Buffer.isBuffer(code) ? code : Buffer.from(code, 'utf8');
  return {
    type,
    raw,
    gz: zlib.gzipSync(raw, { level: 9 }),
    br: zlib.brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }),
    etag: '"' + crypto.createHash('sha1').update(raw).digest('base64url').slice(0, 16) + '"',
  };
}

// Xử lý toàn bộ tệp .js / .css trong public (chạy 1 lần khi khởi động, vài giây)
function build() {
  const t0 = Date.now();
  const lamRoi = process.env.BAO_VE_MA !== '0';
  let esbuild = null, JO = null;
  try { esbuild = require('esbuild'); } catch { console.warn('[BẢO VỆ MÃ] Thiếu esbuild – gửi mã nguyên bản'); }
  if (lamRoi) { try { JO = require('javascript-obfuscator'); } catch { console.warn('[BẢO VỆ MÃ] Thiếu javascript-obfuscator – chỉ rút gọn'); } }
  let goc = 0, ra = 0, n = 0;
  const walk = (dir) => {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, f.name);
      if (f.isDirectory()) { walk(full); continue; }
      const rel = path.relative(PUB, full).split(path.sep).join('/');
      const ext = path.extname(f.name);
      if (ext !== '.js' && ext !== '.css') continue;
      const src = fs.readFileSync(full, 'utf8');
      let out = src;
      try {
        if (ext === '.css' && esbuild) out = esbuild.transformSync(src, { loader: 'css', minify: true, legalComments: 'none' }).code;
        if (ext === '.js' && !rel.startsWith('vendor/')) {
          if (esbuild) out = esbuild.transformSync(src, { minify: true, legalComments: 'none', target: 'es2020' }).code;
          if (JO && !KHONG_LAM_ROI(rel)) out = JO.obfuscate(out, OBF_OPTS).getObfuscatedCode();
        }
      } catch (e) {
        console.error(`[BẢO VỆ MÃ] Lỗi xử lý ${rel}: ${e.message} – gửi bản rút gọn / nguyên bản`);
        try { out = esbuild ? esbuild.transformSync(src, { minify: true, legalComments: 'none', loader: ext === '.css' ? 'css' : 'js' }).code : src; } catch { out = src; }
      }
      kho.set('/' + rel, dongGoi(rel, out, ext === '.css' ? 'text/css; charset=utf-8' : 'application/javascript; charset=utf-8'));
      goc += src.length; ra += out.length; n++;
    }
  };
  walk(PUB);
  thongKe = { tep: n, goc, ra, ms: Date.now() - t0, lam_roi: Boolean(JO) };
  console.log(`[BẢO VỆ MÃ] ${n} tệp mã/giao diện · ${JO ? 'rút gọn + làm rối' : 'rút gọn'} · ${(Date.now() - t0)} ms`);
}

// Phục vụ tệp đã xử lý; trả false nếu không phải tệp trong kho
function serve(req, res) {
  const a = kho.get(req.path);
  if (!a) return false;
  res.set({ 'Content-Type': a.type, ETag: a.etag, Vary: 'Accept-Encoding', 'Cache-Control': 'private, no-cache', 'X-Robots-Tag': 'noindex' });
  if (req.get('If-None-Match') === a.etag) { res.status(304).end(); return true; }
  const ae = req.get('Accept-Encoding') || '';
  if (/\bbr\b/.test(ae)) { res.set('Content-Encoding', 'br'); res.send(a.br); }
  else if (/\bgzip\b/.test(ae)) { res.set('Content-Encoding', 'gzip'); res.send(a.gz); }
  else res.send(a.raw);
  return true;
}

// Trước khi biết người dùng: chỉ cho tải tệp công khai (đăng nhập / khởi tạo)
function congKhai(req, res, next) {
  if (!['GET', 'HEAD'].includes(req.method) || !laCongKhai(req.path)) return next();
  if (!serve(req, res)) next();
}

// Sau khi biết người dùng: tệp mã còn lại chỉ cho người đã đăng nhập
function canDangNhap(req, res, next) {
  if (!['GET', 'HEAD'].includes(req.method) || !kho.has(req.path)) return next();
  if (!req.user) return res.status(404).type('text').send('Không tìm thấy');
  serve(req, res);
}
// Tệp tĩnh khác trong public (ảnh, phông chữ, thư viện bản đồ): ảnh công khai, còn lại bắt buộc đăng nhập
function tepKhac(req, res, next) {
  if (!['GET', 'HEAD'].includes(req.method)) return next();
  if (!req.user && !laCongKhai(req.path)) {
    const f = path.join(PUB, path.normalize(req.path));
    if (f.startsWith(PUB) && fs.existsSync(f) && fs.statSync(f).isFile()) return res.status(404).type('text').send('Không tìm thấy');
  }
  next();
}

module.exports = { build, congKhai, canDangNhap, tepKhac, thongKe: () => thongKe };
