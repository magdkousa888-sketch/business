// bundle-dataLoad.js — Loads Bundles sheet data into window.bundlesData and refreshes the bundle manager UI
(function(){
  'use strict';

  async function loadBundlesFromGoogleSheets(statusEl) {
    try {
      if (statusEl) statusEl.textContent = '⏳ Loading bundles from Google Sheets...';

      // Ensure columns index mapping is loaded for Bundles (best practice – optional)
      if (typeof window.loadColumnsIndexFromSheet === 'function') {
        try { await window.loadColumnsIndexFromSheet('Bundles'); } catch(e) { /* continue */ }
      }

      const SPREADSHEET_ID = window.GOOGLE_SPREADSHEET_ID || '17gh8MZSeFVPQudyTGwYf5_pFWH8yt-xpCPiPy9i8x-U';
      const RANGE = window.BUNDLES_RANGE || 'Bundles!A1:N500';
      let values = null;

      // Prefer googleSheetsClient on the window if present (wrapper for fetch)
      if (window.googleSheetsClient && typeof window.googleSheetsClient.loadRange === 'function') {
        try {
          const resp = await window.googleSheetsClient.loadRange(RANGE);
          values = (resp && resp.values) ? resp.values : null;
        } catch(e) { /* fallthrough */ }
      }

      // Next prefer ServiceAccountAuth fetch
      if (!values && window.ServiceAccountAuth && typeof window.ServiceAccountAuth.fetch === 'function') {
        try {
          const encodedRange = encodeURIComponent(RANGE);
          const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodedRange}`;
          const resp = await window.ServiceAccountAuth.fetch(url, { method: 'GET' });
          if (resp && resp.ok) {
            const body = await resp.json().catch(() => null);
            values = (body && Array.isArray(body.values)) ? body.values : null;
          }
        } catch(e) { /* ignore */ }
      }

      // Fallback to local CSV (bundles.csv)
      if (!values) {
        try {
          const csvUrl = '/bundles.csv';
          const r = await fetch(csvUrl, { cache: 'no-store' });
          if (r.ok) {
            const text = await r.text();
            // quick CSV parse into 2D array; first naive split by lines and commas
            const lines = text.split(/\r?\n/).filter(Boolean);
            if (lines.length > 0) {
              const res = lines.map(l => {
                // simple CSV split (router does not support embedded commas/quotes here)
                return l.split(',').map(c => c.trim());
              });
              values = res;
            }
          }
        } catch(e) {
          console.warn('bundle-dataLoad: CSV fallback failed', e);
        }
      }

      if (!values || !Array.isArray(values) || values.length === 0) {
        if (statusEl) statusEl.textContent = '⚠️ No bundles found in Sheets/CSV';
        return [];
      }

      // Parse to objects using the shared parser if available
      const parseFn = (window.dataLoader && typeof window.dataLoader.parseValuesToObjects === 'function') ? window.dataLoader.parseValuesToObjects : function(vals){
        if (!Array.isArray(vals) || vals.length === 0) return [];
        const headers = vals[0] || [];
        return vals.slice(1).map(r => {
          const obj = {};
          headers.forEach((h,i) => { if (h) obj[h] = r[i] !== undefined ? r[i] : ''; });
          return obj;
        }).filter(row => Object.values(row).some(v => String(v || '').trim() !== ''));
      };

      const rows = parseFn(values);

      // Aggregate rows into bundles keyed by Bundle ID (prefers Bundle ID if present, otherwise Bundle Name with index)
      const bundlesMap = new Map();
      rows.forEach(r => {
        // try multiple possible names for the columns (many variations might exist across sheets)
        const getVal = (keys) => {
          for (const k of keys) {
            if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '') return String(r[k]).trim();
          }
          return '';
        };

        const bundleId = getVal(['Bundle ID','BundleId','Bundle_Id','Bundle Index','Bundle Index']);
        const bundleIndex = getVal(['Bundle Index','BundleIndex']);
        const bundleName = getVal(['Bundle Name','BundleName','Bundle']);
        const bundleExpiry = getVal(['Bundle Expiry','Expiry']);
        const textBefore = getVal(['Text Before','Before Text']);
        const defendant = getVal(['Defendant']);
        const textAfter = getVal(['Text After']);
        const bundleItem = getVal(['Bundle Item','Item','Item Desc']);
        const clientName = getVal(['Client Name','ClientName','Company Name']);
        const itemQty = parseFloat(getVal(['Item Quantity','Qty','Quantity']) || 0) || 0;
        const itemPrice = parseFloat(getVal(['Item Price','Price']) || 0) || 0;
        const taxable = getVal(['Taxable']) || 'Standard';
        const notes = getVal(['Notes','Note']);
        const createdDate = getVal(['Created Date','Create Date','Date Created']);

        // Choose map key
        const key = bundleId || `${bundleName}|${bundleIndex}` || (bundleName || String(Math.random()).slice(2));

        if (!bundlesMap.has(key)) {
          bundlesMap.set(key, {
            id: bundleId || `bundle-${Date.now()}-${bundlesMap.size}`,
            bundleName: bundleName || '',
            bundleExpiry: bundleExpiry || '',
            textBefore: textBefore || '',
            defendant: defendant || '',
            textAfter: textAfter || '',
            clientName: clientName || '',
            items: [],
            notes: notes || '',
            createdDate: createdDate || ''
          });
        }
        const b = bundlesMap.get(key);
        // Store bundleIndex for sorting
        if (!b.bundleIndex && bundleIndex) {
          b.bundleIndex = parseInt(bundleIndex) || 0;
        }
        if (bundleItem) {
          b.items.push({ name: bundleItem, qty: itemQty, price: itemPrice, taxable: taxable, total: (itemQty * itemPrice) });
        }
      });

      const bundlesArray = Array.from(bundlesMap.values());
      
      // Sort bundles by Bundle Index in ascending order (lowest first)
      bundlesArray.sort((a, b) => {
        const indexA = parseInt(a.bundleIndex) || 0;
        const indexB = parseInt(b.bundleIndex) || 0;
        return indexA - indexB; // Ascending order
      });
      
      // Use model API to persist the bundlesData
      try {
        if (window.bundleModel && typeof window.bundleModel.setBundles === 'function') {
          window.bundleModel.setBundles(bundlesArray);
        } else {
          window.bundlesData = bundlesArray;
          try { localStorage.setItem('invoiceApp_bundles', JSON.stringify(window.bundlesData)); } catch(e){ console.warn('bundle-dataLoad: failed to persist bundles data', e); }
        }
      } catch(e) {
        console.warn('bundle-dataLoad: failed to persist bundles via model API', e);
      }

      // If bundle manager modal is open, refresh it (use exposed API from bundle-add.js)
      try {
        const overlay = document.getElementById('bundlesModalOverlay');
        if (overlay && window._bundleManagerGlobal && typeof window._bundleManagerGlobal.updateNavButtons === 'function') {
          // if there are bundles, load the first one
            if (Array.isArray(window.bundlesData) && window.bundlesData.length > 0) {
              if (typeof window._bundleManagerGlobal.clearForm === 'function') window._bundleManagerGlobal.clearForm();
              // load the last bundle in the list for a more recent default
              const lastIndex = window.bundlesData.length - 1;
              if (typeof window._bundleManagerGlobal.loadBundleToForm === 'function' && lastIndex >= 0) {
                window._bundleManagerGlobal.loadBundleToForm(lastIndex);
              }
              window._bundleManagerGlobal.updateNavButtons();
            } else {
              if (typeof window._bundleManagerGlobal.clearForm === 'function') window._bundleManagerGlobal.clearForm();
              window._bundleManagerGlobal.updateNavButtons();
            }
        }
      } catch(e) {
        console.warn('bundle-dataLoad: failed to refresh bundle manager UI', e);
      }

      if (statusEl) statusEl.innerHTML = `<span>Welcome to the workspace Mahmoud!</span>`;
      return window.bundlesData;
    } catch (error) {
      console.error('bundle-dataLoad: Failed to load bundles from Google Sheets', error);
      if (statusEl) statusEl.textContent = `❌ ${error && error.message ? error.message : 'Failed to load bundles'}`;
      return [];
    }
  }

  window.loadBundlesFromGoogleSheets = loadBundlesFromGoogleSheets;

  

  console.log('bundle-dataLoad: ready — call window.loadBundlesFromGoogleSheets() to import bundless from your Google Sheet');
})();
