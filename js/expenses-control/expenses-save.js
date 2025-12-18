// expenses-save.js — Save Expenses modal data via server endpoint (fallbacks to ServiceAccount or OAuth)
(function(){
  'use strict';

  function formatDateForSheet(input){
    if (!input && input !== 0) return '';
    if (input instanceof Date) {
      const d = input; const dd = String(d.getDate()).padStart(2,'0'); const mm = String(d.getMonth()+1).padStart(2,'0'); const yyyy = d.getFullYear(); return `${dd}/${mm}/${yyyy}`;
    }
    const s = String(input).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { const [y,m,d] = s.split('-'); return `${d.padStart(2,'0')}/${m.padStart(2,'0')}/${y}`; }
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) return s;
    const d = new Date(s); if (!isNaN(d.getTime())) return formatDateForSheet(d);
    return s;
  }

  async function appendExpensesToGoogleSheets(expenseGroup, statusEl){
    try {
      if (!expenseGroup || typeof expenseGroup !== 'object') throw new Error('Invalid expenseGroup');
      if (statusEl) statusEl.textContent = '⏳ Preparing append...';

      const SPREADSHEET_ID = (expenseGroup && expenseGroup.spreadsheetId) || window.GOOGLE_SPREADSHEET_ID || '1PLxaoFIZC4LEqFf7kJI1tQNOrGfFsEOjn6kt3QB30HU';
      const SHEET_NAME = 'Expenses';
      console.log('expenses-save: using spreadsheetId=', SPREADSHEET_ID);

      // Resolve Index: use provided index when given and numeric; otherwise compute next numeric index = max(existing Index column) + 1
      async function resolveNextIndex(){
        try {
          // If user supplied an explicit index, prefer it (if numeric return number, else return as-is)
          if (expenseGroup && expenseGroup.index !== undefined && expenseGroup.index !== null && String(expenseGroup.index).trim() !== ''){
            const v = Number(expenseGroup.index);
            if (!isNaN(v)) return v;
            return expenseGroup.index;
          }

          // If we have a cached last index in this session, increment it and use that
          if (window._expensesLastIndex && Number.isFinite(Number(window._expensesLastIndex))) {
            window._expensesLastIndex = Number(window._expensesLastIndex) + 1;
            return window._expensesLastIndex;
          }

          if (statusEl) statusEl.textContent = '⏳ Determining next Index...';

          // 1) Try OAuth client range read (preferred when available)
          try {
            if (window.googleSheetsClient && typeof window.googleSheetsClient.loadRange === 'function'){
              const r = await window.googleSheetsClient.loadRange('Expenses!A2:A5000', (expenseGroup && expenseGroup.spreadsheetId) || window.GOOGLE_SPREADSHEET_ID || null);
              const values = (r && Array.isArray(r.values)) ? r.values.flat() : [];
              const nums = values.map(v => Number(String(v).trim())).filter(n => !isNaN(n) && Number.isFinite(n));
              if (nums.length) {
                const next = Math.max(...nums) + 1;
                window._expensesLastIndex = next;
                return next;
              }
            }
          } catch(e){ console.warn('resolveNextIndex: OAuth loadRange failed', e); }

          // 2) Try ServiceAccount GET (may be allowed for GETs)
          try {
            if (window.ServiceAccountAuth && typeof window.ServiceAccountAuth.fetch === 'function'){
              const enc = encodeURIComponent('Expenses!A2:A5000');
              const url = `https://sheets.googleapis.com/v4/spreadsheets/${(expenseGroup && expenseGroup.spreadsheetId) || window.GOOGLE_SPREADSHEET_ID || ''}/values/${enc}`;
              const resp = await window.ServiceAccountAuth.fetch(url, { method: 'GET' });
              if (resp && resp.ok){
                const body = await resp.json().catch(()=>null);
                const values = (body && Array.isArray(body.values)) ? body.values.flat() : [];
                const nums = values.map(v => Number(String(v).trim())).filter(n => !isNaN(n) && Number.isFinite(n));
                if (nums.length) { const next = Math.max(...nums) + 1; window._expensesLastIndex = next; return next; }
              }
            }
          } catch(e){ console.warn('resolveNextIndex: ServiceAccount fetch failed', e); }

          // Fallback: default to 1
          window._expensesLastIndex = 1;
          return 1;
        } finally {
          if (statusEl) setTimeout(()=>{ if (statusEl) statusEl.textContent = ''; }, 300);
        }
      }

      const groupId = await resolveNextIndex();

      // Helper to reload Expenses sheet and render the newly appended group
      async function reloadAndShowAppendedGroup(gid){
        try {
          if (statusEl) statusEl.textContent = '🔄 Reloading expenses...';
          if (window.expensesBulkLoader && typeof window.expensesBulkLoader.loadAndRenderExpenses === 'function'){
            await window.expensesBulkLoader.loadAndRenderExpenses({ sheetId: SPREADSHEET_ID, range: 'Expenses!A2:AQ500', statusEl });
            const groups = window.expenseGroups || [];
            const found = groups.find(x => String(x.index) === String(gid) || Number(x.index) === Number(gid));
            if (found && typeof window.expensesBulkLoader.renderGroupToModal === 'function') {
              await window.expensesBulkLoader.renderGroupToModal(found);
            }
          }
        } catch (e) {
          console.warn('expenses-save: reloadAndShowAppendedGroup failed', e);
          if (statusEl) statusEl.textContent = `⚠️ Reload failed`; 
        } finally {
          if (statusEl) setTimeout(()=>{ if (statusEl) statusEl.textContent = ''; }, 2000);
        }
      }

      // Normalize metadata access (support both expenseGroup.meta and top-level keys)
      function metaVal(key, altKeys = []) {
        const meta = expenseGroup && typeof expenseGroup === 'object' ? (expenseGroup.meta || expenseGroup) : {};
        if (meta && meta[key] !== undefined && meta[key] !== null) return meta[key];
        for (const a of altKeys) { if (meta[a] !== undefined && meta[a] !== null) return meta[a]; }
        return '';
      }

      const rowsObjects = (expenseGroup.items || []).map(it => ({
        'Index': groupId,
        'Expense Date': formatDateForSheet(metaVal('expenseDate', ['date'])),
        'Start Date': formatDateForSheet(metaVal('startDate', ['startDate','start'])),
        'End Date': formatDateForSheet(metaVal('endDate', ['endDate','end'])),
        'Expense Description': it.description || it.notes || '',
        'Expense Account': it.account || '',
        'Paid Through': metaVal('paidThrough', ['paidThrough','paid_through','paid_by']),
        'Vendor': metaVal('vendor', ['vendor','supplier','payee']),
        'Project Name': metaVal('projectName', ['project','projectName']),
        'VAT Treatment': metaVal('vatTreatment', ['vatTreatment','vat_treatment']),
        'Place Of Supply': metaVal('placeOfSupply', ['placeOfSupply','placeOfSupply','place']),
        'Is Inclusive Tax': metaVal('isInclusiveTax', ['isInclusiveTax','isInclusive','is_inclusive']) || '',
        'Tax Amount': it.tax || 0,
        'Expense Type': it.type || metaVal('expenseType', ['type']) || '',
        'Expense Amount': it.amount || 0,
        'Total': it.total || (Number(it.amount||0) + Number(it.tax||0)),
        'Reference#': it.reference || metaVal('reference', ['reference','ref']) || ''
      }));

      if (!rowsObjects || rowsObjects.length === 0) {
        console.warn('expenses-save: no item rows found in payload', expenseGroup);
        if (statusEl) statusEl.textContent = '⚠️ No item rows to append';
        return { ok: false, error: 'No item rows to append' };
      }

      // Convert objects into arrays; attempt to use Columns Index map if available
      let arrays = null;

      // Explicit mapping for Expenses (user-specified column numbers are 1-based in the spec)
      const EXPENSES_COLUMN_POS = {
        'Index': 0,
        'Expense Date': 1,
        'Start Date': 2,
        'End Date': 3,
        'Expense Description': 4,
        'Expense Account': 5,
        'Paid Through': 7,
        'Vendor': 9,
        'Project Name': 10,
        'VAT Treatment': 11,
        'Place Of Supply': 12,
        'Is Inclusive Tax': 17,
        'Tax Amount': 30,
        'Expense Type': 32,
        'Expense Amount': 36,
        'Total': 37,
        'Reference#': 38
      };

      try {
        let indexMap = null;
        if (typeof window.loadColumnsIndexFromSheet === 'function') {
          try { indexMap = await window.loadColumnsIndexFromSheet(SHEET_NAME, { force: true }); } catch(e) { if (typeof window.getColumnsIndexCached === 'function') indexMap = window.getColumnsIndexCached(SHEET_NAME) || null; }
        } else if (typeof window.getColumnsIndexCached === 'function') indexMap = window.getColumnsIndexCached(SHEET_NAME) || null;

        // If we're writing to the Expenses sheet, prefer an explicit mapping tailored for Expenses
        if (SHEET_NAME === 'Expenses') {
          // Start with canonical positions, then let an indexMap (if present) override them.
          const pos = Object.assign({}, EXPENSES_COLUMN_POS);

          if (indexMap && Object.keys(indexMap).length) {
            // Determine whether indexMap appears 1-based (all values >= 1) or already zero-based (contains 0)
            const numericVals = Object.keys(indexMap).map(k => indexMap[k]).filter(v => Number.isFinite(v));
            const looksOneBased = numericVals.length > 0 && numericVals.every(v => v >= 1);

            Object.keys(indexMap).forEach(k => {
              const raw = indexMap[k];
              if (!Number.isFinite(raw)) return;
              const resolved = looksOneBased ? (Number(raw) - 1) : Number(raw);
              if (resolved >= 0) pos[k] = resolved;
            });
          }

          // Convert each object into an array using pos mapping
          const maxIdx = Math.max(...Object.values(pos).filter(v => Number.isFinite(v)));
          arrays = rowsObjects.map(obj => {
            const arr = new Array(maxIdx + 1).fill('');
            Object.keys(pos).forEach(k => {
              const idx = pos[k];
              if (!Number.isFinite(idx) || idx < 0) return;
              const val = obj.hasOwnProperty(k) ? obj[k] : '';
              arr[idx] = (val === undefined || val === null) ? '' : String(val);
            });
            return arr;
          });

        } else {
          // Generic behavior for other sheets: use Columns Index mapping if available
          if (indexMap && Object.keys(indexMap).length) {
            function mapObjToArray(obj){
              const numericKeys = Object.keys(indexMap).filter(k => Number.isFinite(indexMap[k]));
              if (!numericKeys.length) return null;
              // If indexMap looks one-based, normalize to zero-based
              const numericVals = numericKeys.map(k => indexMap[k]);
              const looksOneBased = numericVals.length > 0 && numericVals.every(v => v >= 1);
              const maxIdx = Math.max(...numericVals.map(v => looksOneBased ? (v-1) : v));
              const arr = new Array(maxIdx + 1).fill('');
              const norm = {}; Object.keys(obj||{}).forEach(k=>norm[String(k).trim().toLowerCase()]=obj[k]);
              Object.keys(indexMap).forEach(k => {
                let idx = indexMap[k]; if (!Number.isFinite(idx)) return; idx = looksOneBased ? (idx - 1) : idx;
                const key = String(k).trim().toLowerCase(); const val = norm.hasOwnProperty(key) ? norm[key] : '';
                arr[idx] = (val === undefined || val === null) ? '' : String(val);
              });
              return arr;
            }
            arrays = rowsObjects.map(o => mapObjToArray(o));
            if (!arrays || arrays.some(a=>a===null)) arrays = null;
          }
        }
      } catch(e){ console.warn('expenses-save: index mapping failed', e); arrays = null; }

      if (!arrays) {
        const HEADER_ORDER = ['Index','Expense Date','Start Date','End Date','Expense Description','Expense Account','Paid Through','Vendor','Project Name','VAT Treatment','Place Of Supply','Is Inclusive Tax','Tax Amount','Expense Type','Expense Amount','Total','Reference#'];
        arrays = rowsObjects.map(obj => HEADER_ORDER.map(h => obj[h] !== undefined && obj[h] !== null ? String(obj[h]) : ''));
      }

      // 1) Try Service Account fetch from client (same approach as Invoices append)
      if (window.ServiceAccountAuth && typeof window.ServiceAccountAuth.fetch === 'function') {
        try {
          if (statusEl) statusEl.textContent = '⏳ Appending using service-account...';
          const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(SHEET_NAME+'!A1')}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
          try { console.log('expenses-save: ServiceAccount append preview', { dataset: SHEET_NAME, rowCount: arrays.length, sampleRow: arrays && arrays[0] ? arrays[0].slice(0, 60) : [], appendUrl }); } catch (e) {}

          // If debug preview is enabled, skip actual append
          if (window.DEBUG_PREVIEW_APPEND === true) {
            console.log('DEBUG_PREVIEW_APPEND set — skipping actual expenses append (non-destructive)');
          } else {
            const resp = await window.ServiceAccountAuth.fetch(appendUrl, { method: 'POST', body: JSON.stringify({ values: arrays }) });
            if (!resp.ok) {
              const txt = await resp.text().catch(()=>null);
              throw new Error(txt || `Service account append failed (${resp.status})`);
            }
            // Reload and show appended group (prefer bulk loader render)
            try { await reloadAndShowAppendedGroup(groupId); } catch(e) { /* ignore */ }

            // Optionally reload via generic data loader as a fallback
            try {
              if (window.dataLoader && typeof window.dataLoader.loadFromGoogleSheets === 'function') {
                const statusEl2 = document.getElementById('expensesSaveStatus');
                await window.dataLoader.loadFromGoogleSheets(statusEl2);
              }
            } catch (e) { /* ignore reload errors */ }

            if (statusEl) statusEl.textContent = `✅ Appended ${arrays.length} row(s)`; statusEl.classList.add('success');
            return { ok: true, rowsAppended: arrays.length };
          }
        } catch (err) { console.warn('service-account append failed', err); if (statusEl) statusEl.textContent = `⚠️ ${err && err.message ? err.message : 'Service account append failed'}`; }
      }

      // 2) Preferred: call serverless endpoint on same origin to avoid CORS and keep SA credentials safe
      if (typeof fetch === 'function') {
        try {
          if (statusEl) statusEl.textContent = '⏳ Uploading to server...';
          try { console.log('expenses-save: append preview', { dataset: SHEET_NAME, rowCount: arrays.length, sampleRow: arrays && arrays[0] ? arrays[0].slice(0, 60) : [] }); } catch (e) {}
          const endpoints = [window.APPEND_API_URL || null, 'http://127.0.0.1:3001/api/append-expenses', 'http://127.0.0.1:3002/api/append-expenses', '/api/append-expenses'].filter(Boolean);
          let lastErr = null; let lastJson = null; let lastResp = null;
          for (const ep of endpoints) {
            try {
              if (statusEl) statusEl.textContent = `⏳ Uploading to ${ep}...`;
              const resp = await fetch(ep, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rows: arrays, sheetName: SHEET_NAME, range: 'A1', spreadsheetId: SPREADSHEET_ID })
              });
              const json = await resp.json().catch(()=>null);
              lastResp = resp; lastJson = json;
              if (resp.ok && json && json.ok) {
                // mark last used index for session so subsequent saves increment correctly
                if (Number.isFinite(Number(groupId))) window._expensesLastIndex = Number(groupId);
                try { await reloadAndShowAppendedGroup(groupId); } catch(e){}
                if (statusEl) statusEl.textContent = `✅ Appended ${arrays.length} row(s)`; statusEl.classList.add('success');
                return { ok: true, rowsAppended: arrays.length, result: json.result };
              }
              const errMsg = (json && json.error) ? json.error : `Server append failed (${resp.status})`;
              lastErr = errMsg;
              // try next endpoint
              continue;
            } catch (e) {
              lastErr = e && e.message ? e.message : String(e);
              continue;
            }
          }
          // If we get here, all endpoints failed
          throw new Error(lastErr || `Server append failed (${lastResp && lastResp.status})`);
        } catch (err) {
          console.warn('Server append failed — falling back to direct methods', err);
          if (statusEl) statusEl.textContent = `⚠️ ${err && err.message ? err.message : 'Server append failed'}`;
          // continue to fallback attempts
        }
      }

      // 3) Try OAuth client if available
      if (window.googleSheetsClient && typeof window.googleSheetsClient.appendRows === 'function') {
        try {
          if (statusEl) statusEl.textContent = '⏳ Appending using OAuth client...';
          await window.googleSheetsClient.appendRows(arrays, SHEET_NAME, SPREADSHEET_ID);
          // mark last used index for session so subsequent saves increment correctly
          if (Number.isFinite(Number(groupId))) window._expensesLastIndex = Number(groupId);
          try { await reloadAndShowAppendedGroup(groupId); } catch(e){}
          if (statusEl) statusEl.textContent = `✅ Appended ${arrays.length} row(s)`; statusEl.classList.add('success');
          return { ok: true, rowsAppended: arrays.length };
        } catch (err) { console.warn('OAuth append failed', err); if (statusEl) statusEl.textContent = `⚠️ ${err && err.message ? err.message : 'OAuth append failed'}`; }
      }

      // 4) Fallback: save locally and prompt CSV download
      try {
        const pending = JSON.parse(localStorage.getItem('expenses_pending_appends') || '[]');
        pending.push({ timestamp: Date.now(), sheet: SHEET_NAME, rows: arrays });
        localStorage.setItem('expenses_pending_appends', JSON.stringify(pending));

        const csv = arrays.map(r => r.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `expenses-append-${Date.now()}.csv`;
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);

        if (statusEl) { statusEl.textContent = '⚠️ Saved locally and downloaded CSV (no Google append available)'; }
        return { ok: false, error: 'Saved locally and downloaded CSV' };
      } catch (saveErr) {
        console.error('Failed to save locally', saveErr);
        if (statusEl) { statusEl.textContent = `⚠️ ${saveErr && saveErr.message ? saveErr.message : 'Save failed'}`; }
        return { ok: false, error: saveErr };
      }

    } catch (err) {
      console.error('appendExpensesToGoogleSheets:', err);
      if (statusEl) { statusEl.textContent = `⚠️ ${err && err.message ? err.message : 'Failed to append to Google Sheets'}`; statusEl.classList.remove('success'); statusEl.classList.add('warn'); }
      return { ok: false, error: err };
    }
  }

  window.appendExpensesToGoogleSheets = appendExpensesToGoogleSheets;

})();
