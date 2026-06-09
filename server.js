/**
 * Daily Report PWA - Node.js Server with Cloud Sync
 * Serves Next.js static export + REST API for cross-device data synchronization
 * Just run: node server.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
// 靜態檔案目錄（Next.js 靜態匯出已直接放在此目錄）
const STATIC_DIR = __dirname;
const DATA_DIR = path.join(STATIC_DIR, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize database file
function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Error loading db.json, creating fresh:', e.message);
  }
  return { reports: {}, projects: {} };
}

function saveDB(db) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving db.json:', e.message);
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
  '.csv':  'text/csv; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.txt':  'text/plain; charset=utf-8',
  '.map':  'application/json',
};

// CORS headers helper
function corsHeaders(methods) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': methods || 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  };
}

// Parse JSON body from request
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      if (!body) { resolve({}); return; }
      try { resolve(JSON.parse(body)); }
      catch (e) { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

// Send JSON response
function sendJSON(res, statusCode, data) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    ...corsHeaders()
  };
  res.writeHead(statusCode, headers);
  res.end(JSON.stringify(data));
}

// 嘗試在靜態目錄中找到檔案
function tryServeStatic(urlPath, res) {
  return new Promise((resolve) => {
    // Security: prevent path traversal
    if (urlPath.includes('..')) {
      resolve(false);
      return;
    }

    // Block access to data directory
    if (urlPath.startsWith('/data/')) {
      res.writeHead(403);
      res.end('Forbidden');
      resolve(true);
      return;
    }

    // 決定要搜尋的目錄
    const staticDir = STATIC_DIR;

    // 處理 basePath：/daily-report/xxx → /xxx
    let filePath = urlPath;
    if (filePath.startsWith('/daily-report')) {
      filePath = filePath.replace('/daily-report', '') || '/';
    }

    // 根路徑重定向到 /daily-report/
    if (urlPath === '/' || urlPath === '') {
      res.writeHead(302, { Location: '/daily-report/' });
      res.end();
      resolve(true);
      return;
    }

    // 對於目錄路徑（如 /dashboard），嘗試 /dashboard/index.html
    const fullPath = path.join(staticDir, filePath);
    const ext = path.extname(fullPath).toLowerCase();

    // 嘗試直接匹配檔案
    const tryFile = (fp) => {
      return new Promise((r) => {
        const fileExt = path.extname(fp).toLowerCase();
        if (!MIME_TYPES[fileExt]) { r(false); return; }

        fs.readFile(fp, (err, data) => {
          if (err) { r(false); return; }

          const headers = {
            'Content-Type': MIME_TYPES[fileExt],
            'Cache-Control': fileExt === '.html' ? 'no-cache' : 'public, max-age=86400',
            'X-Content-Type-Options': 'nosniff',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            ...corsHeaders('GET, OPTIONS')
          };

          res.writeHead(200, headers);
          res.end(data);
          r(true);
        });
      });
    };

    (async () => {
      // 1. 嘗試直接路徑
      if (await tryFile(fullPath)) { resolve(true); return; }

      // 2. 嘗試加 index.html
      if (await tryFile(path.join(fullPath, 'index.html'))) { resolve(true); return; }

      // 3. 對於無副檔名的路徑，嘗試加 .html
      if (!ext && await tryFile(fullPath + '.html')) { resolve(true); return; }

      // 4. SPA fallback：所有未匹配的路徑回傳根 index.html
      if (await tryFile(path.join(staticDir, 'index.html'))) { resolve(true); return; }

      // 5. 404
      resolve(false);
    })();
  });
}

const server = http.createServer(async (req, res) => {
  const urlPath = req.url.split('?')[0];
  const method = req.method;

  // Handle OPTIONS preflight for API routes
  if (method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  // ====== API Routes ======

  // GET /api/reports - Get all reports from server
  if (method === 'GET' && urlPath === '/api/reports') {
    const db = loadDB();
    sendJSON(res, 200, { success: true, reports: db.reports, projects: db.projects });
    return;
  }

  // GET /api/reports/:userId - Get reports for a specific user
  if (method === 'GET' && urlPath.startsWith('/api/reports/') && urlPath !== '/api/reports/') {
    const userId = decodeURIComponent(urlPath.replace('/api/reports/', ''));
    const db = loadDB();
    const userReports = {};
    for (const [key, value] of Object.entries(db.reports)) {
      if (key.startsWith('dailyReport_' + userId + '_')) {
        userReports[key] = value;
      }
    }
    sendJSON(res, 200, { success: true, reports: userReports });
    return;
  }

  // POST /api/report - Save a single report
  if (method === 'POST' && urlPath === '/api/report') {
    try {
      const { key, data } = await parseBody(req);
      if (!key || !data) {
        sendJSON(res, 400, { success: false, error: 'Missing key or data' });
        return;
      }
      const db = loadDB();
      db.reports[key] = { ...data, _serverUpdatedAt: new Date().toISOString() };
      saveDB(db);
      console.log(`  💾 Saved report: ${key}`);
      sendJSON(res, 200, { success: true });
    } catch (e) {
      sendJSON(res, 400, { success: false, error: e.message });
    }
    return;
  }

  // POST /api/sync - Full bidirectional sync
  if (method === 'POST' && urlPath === '/api/sync') {
    try {
      const clientData = await parseBody(req);
      const db = loadDB();

      // Merge client reports into server (client wins on conflict)
      if (clientData.reports && typeof clientData.reports === 'object') {
        for (const [key, value] of Object.entries(clientData.reports)) {
          const existing = db.reports[key];
          if (!existing || !value._serverUpdatedAt ||
              (existing._serverUpdatedAt && value._serverUpdatedAt && value._serverUpdatedAt >= existing._serverUpdatedAt)) {
            db.reports[key] = { ...value, _serverUpdatedAt: new Date().toISOString() };
          }
        }
      }

      // Merge client projects into server
      if (clientData.projects && typeof clientData.projects === 'object') {
        for (const [key, value] of Object.entries(clientData.projects)) {
          const existing = db.projects[key];
          if (!existing || !value._serverUpdatedAt ||
              (existing._serverUpdatedAt && value._serverUpdatedAt && value._serverUpdatedAt >= existing._serverUpdatedAt)) {
            db.projects[key] = { ...value, _serverUpdatedAt: new Date().toISOString() };
          }
        }
      }

      saveDB(db);
      console.log(`  🔄 Synced: ${Object.keys(clientData.reports || {}).length} reports from client, ${Object.keys(db.reports).length} total on server`);
      sendJSON(res, 200, { success: true, reports: db.reports, projects: db.projects });
    } catch (e) {
      sendJSON(res, 400, { success: false, error: e.message });
    }
    return;
  }

  // DELETE /api/report - Delete a single report by key
  if (method === 'DELETE' && urlPath === '/api/report') {
    try {
      const { key } = await parseBody(req);
      if (!key) {
        sendJSON(res, 400, { success: false, error: 'Missing key' });
        return;
      }
      const db = loadDB();
      if (db.reports[key]) {
        delete db.reports[key];
        saveDB(db);
        console.log(`  🗑️ Deleted report: ${key}`);
        sendJSON(res, 200, { success: true });
      } else {
        sendJSON(res, 404, { success: false, error: 'Report not found' });
      }
    } catch (e) {
      sendJSON(res, 400, { success: false, error: e.message });
    }
    return;
  }

  // POST /api/project - Save project data
  if (method === 'POST' && urlPath === '/api/project') {
    try {
      const { key, data } = await parseBody(req);
      if (!key || !data) {
        sendJSON(res, 400, { success: false, error: 'Missing key or data' });
        return;
      }
      const db = loadDB();
      db.projects[key] = { ...data, _serverUpdatedAt: new Date().toISOString() };
      saveDB(db);
      console.log(`  💾 Saved project: ${key}`);
      sendJSON(res, 200, { success: true });
    } catch (e) {
      sendJSON(res, 400, { success: false, error: e.message });
    }
    return;
  }

  // GET /api/ping - Health check
  if (method === 'GET' && urlPath === '/api/ping') {
    sendJSON(res, 200, { success: true, time: new Date().toISOString() });
    return;
  }

  // ====== Static File Routes ======
  const served = await tryServeStatic(urlPath, res);
  if (!served) {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
  ╔══════════════════════════════════════════════════════╗
  ║   📋 每日工作回報表 PWA v2 已啟動！                 ║
  ║   ☁️  自動雲端同步已啟用                              ║
  ╠══════════════════════════════════════════════════════╣
  ║                                                      ║
  ║   本機訪問: http://localhost:${PORT}                     ║
  ║   區網訪問: http://<你的IP>:${PORT}                      ║
  ║                                                      ║
  ║   📱 手機掃碼即可安裝為App                            ║
  ║   ☁️ 自動偵測伺服器，無需手動配置同步                  ║
  ║   📴 支持離線使用（localStorage）                    ║
  ║   🎨 Next.js + shadcn/ui 現代化介面                  ║
  ║                                                      ║
  ║   API 端點:                                          ║
  ║   GET  /api/reports   - 取得所有報表                 ║
  ║   POST /api/report    - 儲存單筆報表                 ║
  ║   POST /api/sync      - 雙向同步                     ║
  ║   POST /api/project   - 儲存專案資料                 ║
  ║   GET  /api/ping      - 健康檢查                     ║
  ║                                                      ║
  ╚══════════════════════════════════════════════════════╝
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
