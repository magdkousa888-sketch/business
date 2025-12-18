// server/static-server.js — Simple static server for Render/GitHub Pages style deployments
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from repo root
const root = path.join(__dirname, '..');
app.use(express.static(root, { extensions: ['html'] }));

// Middleware: if the request looks for a static asset (css/js/img/fonts), and the file is missing, return 404
app.use((req, res, next) => {
  const assetExtPattern = /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff2|woff|ttf)$/i;
  if (assetExtPattern.test(req.path)) {
    const candidate = path.join(root, req.path);
    if (!fs.existsSync(candidate)) {
      console.warn(`static-server: asset not found, returning 404: ${req.path}`);
      return res.status(404).send('Not Found');
    }
  }
  next();
});

// Fallback to index.html for client-side routes (only after asset checks)
app.get('*', (req, res) => {
  res.sendFile(path.join(root, 'index.html'));
});

// Startup check: ensure critical CSS exists and warn loudly if missing
const criticalFiles = [
  path.join(root, 'css', 'page-control', 'roots.css'),
];
criticalFiles.forEach(f => {
  if (!fs.existsSync(f)) {
    console.error(`static-server: CRITICAL FILE MISSING: ${f}\nPlease ensure CSS files are included in your deployment.`);
  }
});

// Diagnostics endpoint to check presence of common CSS files (useful on Render)
app.get('/__static_check', (req, res) => {
  const checkFiles = [
    '/css/page-control/roots.css',
    '/css/page-control/layout.css',
    '/css/page-control/components.css',
    '/css/page-control/buttons.css',
    '/css/page-control/forms.css',
    '/css/page-control/invoice-body.css',
    '/css/page-control/invoice.css',
    '/css/page-control/tables.css',
    '/css/page-control/notifications.css',
    '/css/page-control/print.css',
    '/css/page-control/export.css',
    '/css/page-control/modals.css',
    '/css/modals/small-modal.css',
    '/css/modals/system-logs.css',
    '/css/modals/settings.css'
  ];
  const out = checkFiles.map(p => {
    const fsPath = path.join(root, p.replace(/^\//,''));
    try {
      const stat = fs.existsSync(fsPath) ? fs.statSync(fsPath) : null;
      return { url: p, exists: !!stat, size: stat ? stat.size : 0 };
    } catch (e) {
      return { url: p, exists: false, error: String(e) };
    }
  });
  res.json({ ok: true, base: root, files: out });
});

app.listen(PORT, () => console.log(`Static server listening on ${PORT} (serving ${root})`));