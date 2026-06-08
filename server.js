/**
 * Daily Report PWA - Node.js Server
 * Works on any domain / host. Just run: node server.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const BASE_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
  '.csv':  'text/csv; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2':'font/woff2'
};

const server = http.createServer((req, res) => {
  // Security: prevent path traversal
  let urlPath = req.url.split('?')[0];
  if (urlPath.includes('..')) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // Default to index.html
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.join(BASE_DIR, urlPath);
  const ext = path.extname(filePath).toLowerCase();

  // Only serve known file types
  if (!MIME_TYPES[ext]) {
    res.writeHead(415);
    res.end('Unsupported file type');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('Not Found');
      } else {
        res.writeHead(500);
        res.end('Internal Server Error');
      }
      return;
    }

    const headers = {
      'Content-Type': MIME_TYPES[ext],
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    };

    // CORS headers - allow any domain
    headers['Access-Control-Allow-Origin'] = '*';
    headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';

    res.writeHead(200, headers);
    res.end(data);
  });
});

// Handle OPTIONS preflight
server.on('request', (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    });
    res.end();
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║   📋 每日工作回報表 PWA 已啟動！        ║
  ╠══════════════════════════════════════════╣
  ║                                          ║
  ║   本機訪問: http://localhost:${PORT}         ║
  ║   區網訪問: http://<你的IP>:${PORT}         ║
  ║                                          ║
  ║   手機掃碼即可安裝為App                   ║
  ║   支持離線使用 · 跨裝置同步              ║
  ║                                          ║
  ╚══════════════════════════════════════════╝
  `);

  // Show network IPs for mobile access
  const os = require('os');
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`  📱 手機訪問: http://${net.address}:${PORT}`);
      }
    }
  }
});
