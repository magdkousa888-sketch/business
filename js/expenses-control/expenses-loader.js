// expenses-loader.js — Load auxiliary expense data (payment methods, projects, etc.) from Google Sheets
(function(){
  'use strict';

  async function fetchSheetValues(spreadsheetId, range){
    if (!window.ServiceAccountAuth) throw new Error('ServiceAccountAuth not available');
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
    console.log('expenses-loader: fetching sheet', { spreadsheetId, range, url });
    const resp = await window.ServiceAccountAuth.fetch(url);
    console.log('expenses-loader: fetch response status', resp.status, resp.ok);
    if (!resp.ok) {
      const err = await resp.json().catch(()=>({}));
      console.warn('expenses-loader: fetch returned error json', err);
      throw new Error(err.error?.message || `Failed to fetch sheet: ${resp.status}`);
    }
    const data = await resp.json();
    const values = data.values || [];
    console.log('expenses-loader: raw values count', values.length, 'sample=', values.slice(0,5));
    return values;
  }

  function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // Generic loader: populate a select element from a specified sheet range and column
  async function loadColumnIntoSelect(selectEl, opts){
    opts = opts || {};
    const sheetId = opts.sheetId;
    const range = opts.range || 'A2:C200';
    const columnIndexProvided = Number(opts.columnIndex || 2);
    const colIndex = Math.max(0, columnIndexProvided - 1);
    const placeholder = opts.placeholder || '-- Select --';

    if (!selectEl) throw new Error('Select element not provided');
    if (!sheetId) throw new Error('sheetId is required');
    const statusEl = opts.statusEl;

    try {
      if (statusEl) statusEl.textContent = `⏳ Loading ${placeholder.replace(/<.*?>/g,'')}...`;
      const values = await fetchSheetValues(sheetId, range);
      console.log('expenses-loader: values fetched, total rows=', values.length);
      const items = values.map(r => (r && r[colIndex] !== undefined) ? String(r[colIndex]).trim() : '').filter(v => v !== '');
      console.log('expenses-loader: extracted items (before dedupe) sample=', items.slice(0,10));
      const uniq = Array.from(new Set(items));
      console.log('expenses-loader: unique items count=', uniq.length, 'sample=', uniq.slice(0,15));
      selectEl.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>` + uniq.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
      if (statusEl) statusEl.textContent = uniq.length ? '' : `⚠️ No items found for ${placeholder}`;
      return uniq;
    } catch (e) {
      if (statusEl) statusEl.textContent = `⚠️ ${e.message}`;
      console.warn('expenses-loader: loadColumnIntoSelect failed', e);
      throw e;
    }
  }

  // Backwards-compatible wrapper for payment methods
  async function loadPaymentMethodsIntoSelect(selectEl, opts){
    opts = opts || {};
    opts.placeholder = opts.placeholder || '-- Select Payment --';
    return loadColumnIntoSelect(selectEl, opts);
  }

  window.expensesLoader = {
    fetchSheetValues,
    loadPaymentMethodsIntoSelect,
    loadColumnIntoSelect
  };

})();
