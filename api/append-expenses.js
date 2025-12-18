// api/append-expenses.js — Serverless endpoint to append rows to Google Sheets (Vercel / Netlify style)
// Expects JSON POST: { rows: Array<Array>, sheetName: 'Expenses', range: 'A1', spreadsheetId?: '...' }

const { google } = require('googleapis');

module.exports = async function (req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const body = req.body || {};
    const rows = body.rows;
    const sheetName = body.sheetName || 'Expenses';
    const range = body.range || 'A1';
    const spreadsheetId = body.spreadsheetId || process.env.GOOGLE_SPREADSHEET_ID;

    if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'No rows provided' });
    if (!spreadsheetId) return res.status(400).json({ error: 'Spreadsheet ID not configured on server' });

    // Load service account from env
    const saJson = process.env.SERVICE_ACCOUNT_KEY_JSON;
    if (!saJson) return res.status(500).json({ error: 'Service account not configured (SERVICE_ACCOUNT_KEY_JSON missing)' });

    let sa = null;
    try { sa = JSON.parse(saJson); } catch (e) { return res.status(500).json({ error: 'Invalid SERVICE_ACCOUNT_KEY_JSON' }); }

    const jwtClient = new google.auth.JWT(
      sa.client_email,
      null,
      sa.private_key,
      ['https://www.googleapis.com/auth/spreadsheets']
    );

    await jwtClient.authorize();
    const sheets = google.sheets({ version: 'v4', auth: jwtClient });

    // Server-side allocation: compute next Index (column A) and assign sequential indexes to incoming rows
    let allocatedStart = null;
    try {
      // Read existing Index column (A2:A)
      const idxRange = `${sheetName}!A2:A`;
      const idxResp = await sheets.spreadsheets.values.get({ spreadsheetId, range: idxRange });
      const existing = (idxResp && Array.isArray(idxResp.data.values)) ? idxResp.data.values.flat() : [];
      const nums = existing.map(v => Number(String(v).trim())).filter(n => !isNaN(n) && Number.isFinite(n));
      const maxExisting = nums.length ? Math.max(...nums) : 0;
      allocatedStart = maxExisting + 1;

      // Ensure each row is an array and place allocated index at column A (position 0)
      for (let i = 0; i < rows.length; i++) {
        if (!Array.isArray(rows[i])) rows[i] = Array.isArray(rows[i].values) ? rows[i].values : [];
        // ensure length
        if (rows[i].length < 1) rows[i].length = 1;
        rows[i][0] = String(allocatedStart + i);
      }

      console.log('append-expenses: allocated indexes', allocatedStart, '->', allocatedStart + rows.length - 1);
    } catch (allocErr) {
      console.warn('append-expenses: index allocation failed, proceeding without allocation', allocErr);
    }

    const appendRes = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!${range}`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: rows }
    });

    return res.json({ ok: true, result: appendRes.data, allocatedStart });
  } catch (err) {
    console.error('append-expenses error', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
};