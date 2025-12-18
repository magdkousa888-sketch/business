// server/append-server.js — Simple Express server to append rows using service account (local dev)
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { google } = require('googleapis');

const app = express();
app.use(bodyParser.json());

// Simple CORS middleware to allow requests from the app during local development
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOW_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Simple request logging to help diagnostics
app.use((req, res, next) => { console.log(`append-server: ${req.method} ${req.url}`); next(); });

const fs = require('fs');
const path = require('path');

let SERVICE_ACCOUNT_JSON = process.env.SERVICE_ACCOUNT_KEY_JSON || null;
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || null;

// If SERVICE_ACCOUNT_KEY_JSON not provided in env, try to auto-load from ./Keys folder
if (!SERVICE_ACCOUNT_JSON) {
  try {
    const keysDir = path.resolve(__dirname, '..', 'Keys');
    const primary = path.join(keysDir, 'service-account.json');
    if (fs.existsSync(primary)) {
      SERVICE_ACCOUNT_JSON = fs.readFileSync(primary, 'utf8');
      console.log('Loaded service account from', primary);
    } else if (fs.existsSync(keysDir)) {
      const files = fs.readdirSync(keysDir).filter(f => f.toLowerCase().endsWith('.json'));
      if (files.length) {
        const candidate = path.join(keysDir, files[0]);
        SERVICE_ACCOUNT_JSON = fs.readFileSync(candidate, 'utf8');
        console.log('Loaded service account from', candidate);
      } else {
        console.log('Keys folder found but no .json files present:', keysDir);
      }
    } else {
      console.log('No Keys folder found at expected path:', keysDir);
    }
  } catch (e) {
    console.warn('Failed to auto-load service account from Keys folder', e && e.message ? e.message : e);
  }
}

app.get('/api/ping', (req, res) => {
  // Ensure CORS header present even if middleware skipped
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOW_ORIGIN || '*');
  console.log('append-server: /api/ping request headers', req.headers);
  res.json({ ok: true, time: new Date().toISOString(), serviceAccountConfigured: !!SERVICE_ACCOUNT_JSON });
});

app.post('/api/append-expenses', async (req, res) => {
  try {
    const { rows, sheetName = 'Expenses', range = 'A1', spreadsheetId } = req.body || {};
    console.log('append-server: incoming append request', { sheetName, range, spreadsheetId, rowsProvided: Array.isArray(rows) ? rows.length : 0, keys: Object.keys(req.body || {}) });
    if (Array.isArray(rows) && rows.length) {
      try { console.log('append-server: sample row preview:', rows[0] && Array.isArray(rows[0]) ? rows[0].slice(0,60) : rows[0]); } catch(e) {}
    }
    if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'No rows provided' });
    const ss = spreadsheetId || SPREADSHEET_ID;
    console.log('append-server: target spreadsheetId=', ss, ' (provided in request? ', !!spreadsheetId, ')');
    if (!ss) return res.status(400).json({ error: 'Spreadsheet ID not configured', spreadsheetId: ss });
    if (!SERVICE_ACCOUNT_JSON) return res.status(500).json({ error: 'Service account not configured (SERVICE_ACCOUNT_KEY_JSON missing in .env)' });

    const sa = JSON.parse(SERVICE_ACCOUNT_JSON);
    const jwtClient = new google.auth.JWT(sa.client_email, null, sa.private_key, ['https://www.googleapis.com/auth/spreadsheets']);
    await jwtClient.authorize();
    const sheets = google.sheets({ version: 'v4', auth: jwtClient });

    // Fetch spreadsheet metadata to verify sheet titles and choose the exact title
    let finalSheetName = sheetName;
    let titles = [];
    try {
      const meta = await sheets.spreadsheets.get({ spreadsheetId: ss, fields: 'sheets.properties' });
      titles = (meta.data.sheets || []).map(s => s.properties && s.properties.title ? String(s.properties.title) : '').filter(Boolean);
      console.log('append-server: available sheet titles=', titles);
      // Exact match, or case-insensitive match
      if (!titles.includes(sheetName)) {
        const found = titles.find(t => t.trim().toLowerCase() === String(sheetName).trim().toLowerCase());
        if (found) {
          finalSheetName = found;
          console.log(`append-server: resolved sheet name '${sheetName}' -> '${finalSheetName}'`);
        } else {
          // Attempt partial match (startsWith)
          const partial = titles.find(t => t.trim().toLowerCase().startsWith(String(sheetName).trim().toLowerCase()));
          if (partial) {
            finalSheetName = partial;
            console.log(`append-server: partial-resolved sheet name '${sheetName}' -> '${finalSheetName}'`);
          }
        }
      }
    } catch(metaErr) {
      console.warn('append-server: failed to read spreadsheet metadata', metaErr && metaErr.message ? metaErr.message : metaErr);
    }

    // Try append and gracefully handle 'Unable to parse range' by retrying alternatives
    const tryAppend = async (rangeStr) => {
      try {
        console.log('append-server: attempting append with range=', rangeStr);
        return await sheets.spreadsheets.values.append({
          spreadsheetId: ss,
          range: rangeStr,
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          requestBody: { values: rows }
        });
      } catch (e) {
        // rethrow to allow caller to decide
        throw e;
      }
    };

    const tried = [];
    try {
      // First attempt: sheetName!A1
      tried.push(`${finalSheetName}!${range}`);
      let r = await tryAppend(`${finalSheetName}!${range}`);
      return res.json({ ok: true, result: r.data });
    } catch (firstErr) {
      console.warn('append-server: first append failed', firstErr && (firstErr.message || firstErr.response || firstErr));
      const msg = String(firstErr && (firstErr.message || (firstErr.response && firstErr.response.data) || firstErr));

      // If parse error, retry with sheet name only
      if (msg.includes('Unable to parse range') || msg.includes('Invalid value')) {
        try {
          tried.push(`${finalSheetName}`);
          const r2 = await tryAppend(`${finalSheetName}`);
          return res.json({ ok: true, result: r2.data });
        } catch (secondErr) {
          console.warn('append-server: second append attempt failed', secondErr && (secondErr.message || secondErr.response || secondErr));
          // If the finalSheetName is not the one in metadata, fallback to first available sheet
          if (titles && titles.length && finalSheetName !== titles[0]) {
            console.log('append-server: falling back to first sheet in metadata:', titles[0]);
            try {
              tried.push(`${titles[0]}!${range}`);
              const r3 = await tryAppend(`${titles[0]}!${range}`);
              return res.json({ ok: true, result: r3.data });
            } catch (thirdErr) {
              console.warn('append-server: third append attempt failed', thirdErr && (thirdErr.message || thirdErr.response || thirdErr));
              const full = (thirdErr && thirdErr.response && thirdErr.response.data) ? thirdErr.response.data : (thirdErr && thirdErr.message ? thirdErr.message : thirdErr);
              return res.status(500).json({ error: `Unable to append rows (tried ranges: ${tried.join(', ')}). Last error: ${full}`, sheetTitles: titles });
            }
          }

          const full = (secondErr && secondErr.response && secondErr.response.data) ? secondErr.response.data : (secondErr && secondErr.message ? secondErr.message : secondErr);
          return res.status(500).json({ error: `Unable to append rows (tried ranges: ${tried.join(', ')}). Last error: ${full}`, sheetTitles: titles });
        }
      }

      const full = (firstErr && firstErr.response && firstErr.response.data) ? firstErr.response.data : (firstErr && firstErr.message ? firstErr.message : firstErr);
      return res.status(500).json({ error: `Append failed: ${full}`, sheetTitles: titles });
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || String(e) });
  }
});

// Serve static files (repo root) so you can open index.html from the same origin
app.use('/', express.static(path.join(__dirname, '..')));

// Fallback test endpoint (helps clients probe alternate port 3002)
app.get('/api/ping-3002', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOW_ORIGIN || '*');
  res.json({ ok: true, portProbe: 3002, time: new Date().toISOString() });
});

const BASE_PORT = Number(process.env.PORT || 3001);
// Attempt to listen on BASE_PORT, fall back to next ports if in use
(function tryListen(port, attemptsLeft = 5) {
  const server = app.listen(port, () => console.log(`Append server listening on ${port}`));
  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE' && attemptsLeft > 0) {
      console.warn(`Port ${port} in use, trying ${port + 1}...`);
      tryListen(port + 1, attemptsLeft - 1);
    } else {
      console.error('Failed to start append server:', err);
      process.exit(1);
    }
  });
})(BASE_PORT, 10);