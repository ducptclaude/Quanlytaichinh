// Sinh mục lục hàm cho docs/SO-DO-CAU-TRUC-CODE.md (mục 10). Chạy: node scripts/tao-muc-luc.js <tệp ra.md> (cần gói acorn – đi kèm javascript-obfuscator)
// Sinh mục lục hàm cấp ngoài cùng (tên : dòng) cho từng tệp + danh sách đường dẫn máy chủ
const acorn = require('acorn'); const fs = require('fs');
const FILES = ['server.js', 'lib/report.js', 'lib/db.js', 'lib/validate.js', 'lib/cost.js', 'lib/revenue.js', 'lib/subcontract.js', 'lib/dashboard.js', 'lib/export-dtcp.js', 'lib/tygia.js', 'lib/audit.js', 'lib/security.js', 'lib/auth.js', 'lib/bao-ve-ma.js', 'lib/totp.js', 'lib/demo.js',
  'public/common.js', 'public/app.js', 'public/report.js', 'public/dash-tong.js', 'public/dash-pdf.js', 'public/assistant.js', 'public/i18n.js', 'public/bao-ve.js', 'public/map.js', 'public/motion.js'];
let out = '';
for (const f of FILES) {
  const s = fs.readFileSync(f, 'utf8'), lineOf = (pos) => s.slice(0, pos).split('\n').length;
  let ast; try { ast = acorn.parse(s, { ecmaVersion: 'latest', sourceType: 'script', allowHashBang: true, allowReturnOutsideFunction: true }); } catch (e) { out += `\n### ${f}\n(không đọc được: ${e.message})\n`; continue; }
  const ds = [];
  for (const n of ast.body) {
    if (n.type === 'FunctionDeclaration') ds.push(`${n.id.name}:${lineOf(n.start)}`);
    else if (n.type === 'VariableDeclaration') for (const d of n.declarations) if (d.id.type === 'Identifier' && d.init && /Function|Object|Array/.test(d.init.type)) ds.push(`${d.id.name}:${lineOf(n.start)}`);
  }
  out += `\n### ${f} (${s.split('\n').length} dòng · ${ds.length} hàm / hằng)\n\n\`\`\`\n${ds.join('  ')}\n\`\`\`\n`;
}
fs.writeFileSync(process.argv[2], out);
