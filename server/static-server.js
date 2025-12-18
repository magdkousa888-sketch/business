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

app.listen(PORT, () => console.log(`Static server listening on ${PORT} (serving ${root})`));