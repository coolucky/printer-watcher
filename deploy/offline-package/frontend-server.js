const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = parseInt(process.env.FRONTEND_PORT || '9191', 10);
const BACKEND_PORT = parseInt(process.env.BACKEND_PORT || '3001', 10);
const DIST_DIR = path.join(__dirname, 'dist');
const BACKEND_URL = 'http://127.0.0.1:' + BACKEND_PORT;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url);
  let pathname = parsedUrl.pathname;

  // API proxy to backend
  if (pathname.startsWith('/api')) {
    const options = {
      hostname: '127.0.0.1',
      port: BACKEND_PORT,
      path: req.url,
      method: req.method,
      headers: Object.assign({}, req.headers, { host: '127.0.0.1:' + BACKEND_PORT })
    };
    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });
    proxyReq.on('error', () => {
      res.writeHead(502);
      res.end('Backend unavailable');
    });
    req.pipe(proxyReq);
    return;
  }

  // Static file serving
  let filePath = path.join(DIST_DIR, pathname === '/' ? 'index.html' : pathname);

  // Security: prevent path traversal
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // SPA fallback
      filePath = path.join(DIST_DIR, 'index.html');
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        res.writeHead(500);
        res.end('Internal Server Error');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });
});

server.on('error', (err) => {
  console.error('[Frontend] Server error:', err.message);
  if (err.code === 'EADDRINUSE') {
    console.error('[Frontend] Port ' + PORT + ' already in use, retrying in 5s...');
    setTimeout(() => server.listen(PORT, '0.0.0.0'), 5000);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('Frontend server running at http://0.0.0.0:' + PORT);
  console.log('API proxy: /api/* -> ' + BACKEND_URL);
});

process.on('uncaughtException', (err) => {
  console.error('[Frontend] Uncaught exception:', err.message);
  console.error(err.stack);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Frontend] Unhandled rejection:', reason);
});
