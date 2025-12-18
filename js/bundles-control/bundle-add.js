// bundle-add.js — Adds a modal for creating bundles
// This file is now a thin wrapper re-exposing the bundle UI created in bundle-ui.js
(function(){
  'use strict';
  // Provide a runtime wrapper for openAddBundleModal so toolbar handlers can call it
  // even if bundle-ui.js has not loaded yet. If bundle-ui loads later, we rewire to the real function.
  function _bundleOpenFallback() { alert('Bundle UI not loaded'); }
  window.openAddBundleModal = function(...args) {
    if (window.bundleUI && typeof window.bundleUI.openAddBundleModal === 'function') {
      return window.bundleUI.openAddBundleModal(...args);
    }
    return _bundleOpenFallback(...args);
  };
  // Try to rewire to the real modal function when bundle-ui becomes available
  (function ensureWiring(){
    const MAX_ATTEMPTS = 30; // poll for up to ~3 seconds
    let attempts = 0;
    const timer = setInterval(() => {
      if (window.bundleUI && typeof window.bundleUI.openAddBundleModal === 'function') {
        window.openAddBundleModal = window.bundleUI.openAddBundleModal;
        clearInterval(timer);
        return;
      }
      attempts++;
      if (attempts >= MAX_ATTEMPTS) {
        clearInterval(timer);
      }
    }, 100);
  })();

  // Move append-to-Google-Sheets helper here (was previously in bundle-dataLoad.js)
  async function appendBundleToGoogleSheets(bundle, statusEl) {
    try {
      if (!bundle || typeof bundle !== 'object') throw new Error('Invalid bundle');
      if (statusEl) statusEl.textContent = '⏳ Appending bundle to Google Sheets...';

      const SPREADSHEET_ID = window.GOOGLE_SPREADSHEET_ID || '17gh8MZSeFVPQudyTGwYf5_pFWH8yt-xpCPiPy9i8x-U';
      const SHEET_NAME = window.BUNDLES_SHEET_NAME || 'Bundles';
      const RANGE = `${SHEET_NAME}!A1:append`;

      // Build object rows (one row per item) and then map to arrays using Columns Index mapping
      const rowsToAppend = (bundle.items || []).map((it, i) => {
        return {
          'Bundle ID': bundle.id || `bundle-${Date.now()}`,
          'Bundle Index': (window.bundlesData && window.bundlesData.length ? (window.bundlesData.length + 1) : 1),
          'Created Date': bundle['Created Date'] || bundle.createdDate || '',
          'Create Date': bundle['Create Date'] || bundle['Created Date'] || bundle.createdDate || '',
          'Bundle Name': bundle.bundleName || '',
          'Bundle Expiry': bundle.bundleExpiry || '',
          'Text Before': bundle.textBefore || '',
          'Defendant': bundle.defendant || '',
          'Text After': bundle.textAfter || '',
          'Bundle Item': it.name || '',
          'Item Quantity': it.qty || 0,
          'Item Price': it.price || 0,
          'Taxable': it.taxable || 'Standard',
          'Client Name': bundle.clientName || '',
          'Notes': bundle.notes || ''
        };
      });

      // Ensure we have at least one object row for bundles without items
      if (!rowsToAppend || rowsToAppend.length === 0) {
        rowsToAppend.push({
          'Bundle ID': bundle.id || `bundle-${Date.now()}`,
          'Bundle Index': (window.bundlesData && window.bundlesData.length ? (window.bundlesData.length + 1) : 1),
          'Created Date': bundle['Created Date'] || bundle.createdDate || '',
          'Create Date': bundle['Create Date'] || bundle['Created Date'] || bundle.createdDate || '',
          'Bundle Name': bundle.bundleName || '',
          'Bundle Expiry': bundle.bundleExpiry || '',
          'Text Before': bundle.textBefore || '',
          'Defendant': bundle.defendant || '',
          'Text After': bundle.textAfter || '',
          'Bundle Item': '',
          'Item Quantity': 0,
          'Item Price': 0,
          'Taxable': 'Standard',
          'Client Name': bundle.clientName || '',
          'Notes': bundle.notes || ''
        });
      }

      // Prepare mapping helper and header order fallback
      const HEADER_ORDER = [ 'Bundle ID', 'Bundle Index', 'Created Date', 'Bundle Name', 'Bundle Expiry', 'Text Before', 'Defendant', 'Text After', 'Bundle Item', 'Item Quantity', 'Item Price', 'Taxable', 'Client Name', 'Notes' ];

      function getBundleAppendRow(obj, { preferIndexMap = true, indexMap = null } = {}){
        try {
          let resolvedIndexMap = indexMap;
          if (!resolvedIndexMap && typeof window.getColumnsIndexCached === 'function') resolvedIndexMap = window.getColumnsIndexCached('Bundles') || null;
          if (resolvedIndexMap && Object.keys(resolvedIndexMap).length > 0 && preferIndexMap) {
            const numericKeys = Object.keys(resolvedIndexMap).filter(k => Number.isFinite(resolvedIndexMap[k]));
            if (numericKeys.length > 0) {
              const maxIndex = Math.max(...numericKeys.map(k => resolvedIndexMap[k]));
              const arr = new Array(maxIndex + 1).fill('');
              const objNorm = {};
              Object.keys(obj || {}).forEach(k => objNorm[String(k).trim().toLowerCase()] = obj[k]);
              Object.keys(resolvedIndexMap).forEach(k => {
                const idx = resolvedIndexMap[k];
                if (!Number.isFinite(idx)) return;
                const normKey = String(k).trim().toLowerCase();
                const val = objNorm.hasOwnProperty(normKey) ? objNorm[normKey] : '';
                arr[idx] = (val === undefined || val === null) ? '' : String(val);
              });
              return arr;
            }
          }
          return null;
        } catch(e) { console.warn('getBundleAppendRow helper error', e); return null; }
      }

      // Try mapping via Columns Index and map to arrays; fallback to Header order
      let rows = null;
      try {
        let indexMap = null;
        if (typeof window.loadColumnsIndexFromSheet === 'function') {
          try { indexMap = await window.loadColumnsIndexFromSheet('Bundles', { force: true }); } catch(e) { console.warn('bundle-add: Failed to force-load columns index for Bundles', e); if (typeof window.getColumnsIndexCached === 'function') indexMap = window.getColumnsIndexCached('Bundles') || null; }
        } else if (typeof window.getColumnsIndexCached === 'function') {
          indexMap = window.getColumnsIndexCached('Bundles') || null;
        }

        const numericKeys = indexMap ? Object.keys(indexMap).filter(k => Number.isFinite(indexMap[k])) : [];
        if (indexMap && numericKeys.length > 0) {
          rows = rowsToAppend.map(obj => getBundleAppendRow(obj, { preferIndexMap: true, indexMap }));
        }
      } catch(e) {
        console.warn('bundle-add: error building mapped rows for Bundles', e);
        rows = null;
      }

      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        rows = rowsToAppend.map(obj => HEADER_ORDER.map(h => obj[h] !== undefined && obj[h] !== null ? String(obj[h]) : ''));
      }

      // Diagnostic preview
      try { console.log('DEBUG: Appending Bundles rows', { sheet: SHEET_NAME, rowsCount: rows.length, sampleRow: rows[0] }); } catch(e) {}

      // Prefer googleSheetsClient append function
      if (window.googleSheetsClient && typeof window.googleSheetsClient.appendRange === 'function') {
        // wrapper may accept (range, values)
        await window.googleSheetsClient.appendRange(RANGE, rows);
      } else if (window.ServiceAccountAuth && typeof window.ServiceAccountAuth.fetch === 'function') {
        const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
        const response = await window.ServiceAccountAuth.fetch(appendUrl, {
          method: 'POST',
          body: JSON.stringify({ values: rows })
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error?.message || `Failed to append (${response.status})`);
        }
      } else {
        // No server API available; fallback to CSV or local persistence
        throw new Error('No Google Sheets client available to append bundles');
      }

      // Refresh data from sheets to get up-to-date index/IDs
      try {
        if (typeof window.loadBundlesFromGoogleSheets === 'function') await window.loadBundlesFromGoogleSheets();
      } catch(e){ /* ignore */ }

      if (statusEl) { statusEl.textContent = `✅ Appended ${rows.length} row(s) to Google Sheets`; statusEl.classList.remove('warn'); statusEl.classList.add('success'); }
      return { ok: true, rowsAppended: rows.length };
    } catch (err) {
      console.error('appendBundleToGoogleSheets:', err);
      if (statusEl) { statusEl.textContent = `⚠️ ${err && err.message ? err.message : 'Failed to append to Google Sheets'}`; statusEl.classList.remove('success'); statusEl.classList.add('warn'); }
      return { ok: false, error: err };
    }
  }

  window.appendBundleToGoogleSheets = appendBundleToGoogleSheets;
})();
