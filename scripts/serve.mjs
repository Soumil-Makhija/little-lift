import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
const port = Number(process.env.PORT || 4173);
createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const path = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    const relative = path.slice(root.length);
    if (!path.startsWith(root) || relative.split(sep).some(part => part.startsWith('.') || part === 'node_modules') || !types[extname(path)]) {
      res.writeHead(404); res.end('Not found'); return;
    }
    const body = await readFile(path);
    res.writeHead(200, { 'Content-Type': `${types[extname(path)]}; charset=utf-8`, 'X-Content-Type-Options': 'nosniff' });
    res.end(body);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Little Lift: http://127.0.0.1:${port}`));
