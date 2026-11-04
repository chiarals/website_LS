// Local server for trying the reserved area without touching the real site:
// saving and publishing write the files in this folder instead of committing to GitHub.
//   node tools/admin-dev.mjs   ->  http://localhost:5501/admin/
// Undo a test with git (git checkout -- . && git clean -fd content assets/foto/uploads).
import http from 'http';
import fs from 'fs';
import path from 'path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const port = Number(process.env.PORT) || 5501;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml' };

const inside = (p) => {
  const full = path.resolve(root, p);
  if (!full.startsWith(root + path.sep)) throw new Error('outside the site folder');
  return full;
};
const body = (req) => new Promise((ok) => { let s = ''; req.on('data', (c) => { s += c; }); req.on('end', () => ok(s)); });

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname === '/__dev/ping') return res.end('ok');
    if (url.pathname === '/__dev/file') {
      const file = inside(url.searchParams.get('path'));
      if (!fs.existsSync(file)) { res.statusCode = 404; return res.end(); }
      return res.end(fs.readFileSync(file));
    }
    if (url.pathname === '/__dev/commit' && req.method === 'POST') {
      const { files, message } = JSON.parse(await body(req));
      for (const [p, f] of Object.entries(files)) {
        const file = inside(p);
        if (f === null) fs.rmSync(file, { force: true });
        else {
          fs.mkdirSync(path.dirname(file), { recursive: true });
          fs.writeFileSync(file, typeof f === 'string' ? f : Buffer.from(f.base64, 'base64'));
        }
      }
      console.log(`commit: ${message} (${Object.keys(files).join(', ')})`);
      return res.end('ok');
    }
    let file = inside(decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html');
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.statusCode = 404; return res.end('not found'); }
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.end(fs.readFileSync(file));
  } catch (e) {
    res.statusCode = 500;
    res.end(String(e.message));
  }
}).listen(port, () => console.log(`http://localhost:${port}/admin/`));
