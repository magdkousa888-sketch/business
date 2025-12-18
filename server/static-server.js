// server/static-server.js — Simple static server for Render/GitHub Pages style deployments
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from repo root
const root = path.join(__dirname, '..');
app.use(express.static(root, { extensions: ['html'] }));

// Fallback to index.html for client-side routes
app.get('*', (req, res) => {
  res.sendFile(path.join(root, 'index.html'));
});

app.listen(PORT, () => console.log(`Static server listening on ${PORT} (serving ${root})`));