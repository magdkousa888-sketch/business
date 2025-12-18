// expenses-bulk-loader.js — Load Expenses sheet, group by index, and render grouped expenses into modal
(function(){
  'use strict';

  // Column mapping (1-based indexes as provided)
  const COL = {
    INDEX: 1,
    EXPENSE_DATE: 2,
    START_DATE: 3,
    END_DATE: 4,
    EXPENSE_DESCRIPTION: 5,
    EXPENSE_ACCOUNT: 6,
    PAID_THROUGH: 8,
    VENDOR: 10,
    PROJECT_NAME: 11,
    VAT_TREATMENT: 12,
    PLACE_OF_SUPPLY: 13,
    IS_INCLUSIVE_TAX: 18,
    TAX_AMOUNT: 31,
    EXPENSE_TYPE: 33,
    EXPENSE_AMOUNT: 37,
    TOTAL: 38,
    REFERENCE: 39
  };

  function v(row, idx){ return (row && row.length >= idx) ? String(row[idx-1] || '').trim() : ''; }

  // Normalize various date formats into yyyy-MM-dd suitable for <input type="date"> elements
  function normalizeDate(val){
    if (!val && val !== 0) return '';
    const s = String(val).trim();
    if (!s) return '';
    // already yyyy-mm-dd — but validate ranges
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)){
      const [y, m, d] = s.split('-').map(Number);
      if (m >=1 && m <= 12 && d >=1 && d <= 31) return s;
      // if month out of range but day is valid, maybe it's YYYY-DD-MM -> swap
      if (m > 12 && d >=1 && d <= 12) {
        const mm = String(d).padStart(2,'0');
        const dd = String(m).padStart(2,'0');
        const res = `${y}-${mm}-${dd}`;
        console.warn('expenses-bulk-loader: normalizeDate swapped invalid YYYY-MM-DD to', res, 'original=', s);
        return res;
      }
      console.warn('expenses-bulk-loader: normalizeDate invalid YYYY-MM-DD', s);
      return '';
    }
    // ISO/parseable dates
    const dObj = new Date(s);
    if (!isNaN(dObj.getTime())){
      const yyyy = dObj.getFullYear();
      const mm = String(dObj.getMonth()+1).padStart(2,'0');
      const dd = String(dObj.getDate()).padStart(2,'0');
      return `${yyyy}-${mm}-${dd}`;
    }
    // split numeric-ish formats
    const parts = s.split(/[\/\.\-]/).map(p=>p.trim()).filter(Boolean);
    if (parts.length===3){
      // if first is YYYY
      if (/^\d{4}$/.test(parts[0])){
        const mm = parts[1].padStart(2,'0');
        const dd = parts[2].padStart(2,'0');
        if (Number(mm) >=1 && Number(mm) <=12 && Number(dd) >=1 && Number(dd) <=31) return `${parts[0]}-${mm}-${dd}`;
        // possibly YYYY-DD-MM -> swap
        if (Number(parts[1]) > 12 && Number(parts[2]) <=12) {
          const res = `${parts[0]}-${String(parts[2]).padStart(2,'0')}-${String(parts[1]).padStart(2,'0')}`;
          console.warn('expenses-bulk-loader: normalizeDate swapped YYYY-DD-MM to', res, 'original=', s);
          return res;
        }
      }
      // if last is YYYY assume MM/DD/YYYY
      if (/^\d{4}$/.test(parts[2])){
        const mm = parts[0].padStart(2,'0');
        const dd = parts[1].padStart(2,'0');
        if (Number(mm) >=1 && Number(mm) <=12 && Number(dd) >=1 && Number(dd) <=31) return `${parts[2]}-${mm}-${dd}`;
        // maybe DD/MM/YYYY -> swap
        if (Number(parts[0]) > 12 && Number(parts[1]) <=12) {
          const res = `${parts[2]}-${String(parts[1]).padStart(2,'0')}-${String(parts[0]).padStart(2,'0')}`;
          console.warn('expenses-bulk-loader: normalizeDate swapped DD/MM/YYYY to', res, 'original=', s);
          return res;
        }
      }
    }
    // Excel serial number fallback (days since 1899-12-31)
    const n = Number(s);
    if (!isNaN(n) && n > 0 && n < 60000){
      const dt = new Date(Date.UTC(1899,11,30 + Math.floor(n)));
      const yyyy = dt.getUTCFullYear();
      const mm = String(dt.getUTCMonth()+1).padStart(2,'0');
      const dd = String(dt.getUTCDate()).padStart(2,'0');
      return `${yyyy}-${mm}-${dd}`;
    }
    return '';
  }

  // Map short codes to full place names when needed
  function mapPlaceOfSupplyValue(val){
    if (!val && val !== 0) return '';
    const s = String(val).trim();
    if (!s) return '';
    const MAP = {
      'DU': 'Dubai',
      'DX': 'Dubai',
      'DXB': 'Dubai',
      'SH': 'Sharjah',
      'AB': 'Abu Dhabi',
      'AJ': 'Ajman',
      'FU': 'Fujairah',
      'RA': 'Ras Al Khaimah',
      'RK': 'Ras Al Khaimah',
      'UM': 'Umm Al Quwain'
    };
    const up = s.toUpperCase();
    // try full token first, then first two letters
    if (MAP[up]) { console.log('expenses-bulk-loader: mapped place code', s, '->', MAP[up]); return MAP[up]; }
    const firstTwo = up.slice(0,2);
    if (MAP[firstTwo]) { console.log('expenses-bulk-loader: mapped place prefix', firstTwo, '->', MAP[firstTwo], 'original=', s); return MAP[firstTwo]; }
    return s;
  }

  function mapRow(row){
    return {
      index: v(row, COL.INDEX),
      expenseDate: normalizeDate(v(row, COL.EXPENSE_DATE)),
      startDate: normalizeDate(v(row, COL.START_DATE)),
      endDate: normalizeDate(v(row, COL.END_DATE)),
      description: v(row, COL.EXPENSE_DESCRIPTION),
      account: v(row, COL.EXPENSE_ACCOUNT),
      paidThrough: v(row, COL.PAID_THROUGH),
      vendor: v(row, COL.VENDOR),
      projectName: v(row, COL.PROJECT_NAME),
      vatTreatment: v(row, COL.VAT_TREATMENT),
      placeOfSupply: v(row, COL.PLACE_OF_SUPPLY),
      isInclusiveTax: v(row, COL.IS_INCLUSIVE_TAX),
      taxAmount: parseFloat(v(row, COL.TAX_AMOUNT)) || 0,
      expenseType: v(row, COL.EXPENSE_TYPE),
      expenseAmount: parseFloat(v(row, COL.EXPENSE_AMOUNT)) || 0,
      total: parseFloat(v(row, COL.TOTAL)) || 0,
      reference: v(row, COL.REFERENCE)
    };
  }

  async function fetchRows(spreadsheetId, range){
    if (!window.expensesLoader || typeof window.expensesLoader.fetchSheetValues !== 'function') throw new Error('expensesLoader not available');
    const rows = await window.expensesLoader.fetchSheetValues(spreadsheetId, range);
    console.log('expenses-bulk-loader: fetched rows=', rows.length);
    return rows;
  }

  function groupRows(rows){
    const mapped = rows.map(mapRow);
    const groups = {};
    mapped.forEach(r => {
      const id = r.index || '__no_index__';
      groups[id] = groups[id] || { index: id, meta: null, items: [] };
      // Use first row to populate meta (unified)
      if (!groups[id].meta) {
        groups[id].meta = {
          expenseDate: r.expenseDate,
          startDate: r.startDate,
          endDate: r.endDate,
          paidThrough: r.paidThrough,
          vendor: r.vendor,
          projectName: r.projectName,
          vatTreatment: r.vatTreatment,
          placeOfSupply: r.placeOfSupply,
          isInclusiveTax: r.isInclusiveTax
        };
      }
      // item
      groups[id].items.push({ description: r.description, account: r.account, amount: r.expenseAmount, tax: r.taxAmount, total: r.total, reference: r.reference, type: r.expenseType });
    });
    const arr = Object.values(groups);
    console.log('expenses-bulk-loader: grouped into', arr.length, 'groups');
    return arr;
  }

  // Helper to ensure account options are ready
  async function ensureAccounts(){
    if (Array.isArray(window.expenseAccounts) && window.expenseAccounts.length) return window.expenseAccounts;
    if (window.expensesLoader && typeof window.expensesLoader.loadColumnIntoSelect === 'function') {
      try {
        const tmp = document.createElement('select');
        const uniq = await window.expensesLoader.loadColumnIntoSelect(tmp, { sheetId: window.GOOGLE_SPREADSHEET_ID || '1PLxaoFIZC4LEqFf7kJI1tQNOrGfFsEOjn6kt3QB30HU', range: 'Expense Accounts!A2:F200', columnIndex: 2, placeholder: '-- Select Account --' });
        window.expenseAccounts = uniq || [];
        return window.expenseAccounts;
      } catch(e){ console.warn('expenses-bulk-loader: ensureAccounts failed', e); return []; }
    }
    return [];
  }

  // Render one group into the open modal
  async function renderGroupToModal(group, opts){
    opts = opts || {};
    if (!document.getElementById('expensesModalOverlay')) {
      if (typeof window.openExpensesManager === 'function') { window.openExpensesManager(); await new Promise(r => setTimeout(r,120)); }
      else { console.warn('expenses-bulk-loader: modal opener not available'); }
    }

    // set meta
    const m = group.meta || {};
    const setVal = (id, val) => { const el = document.getElementById(id); if (!el) return; try {
      // normalize date fields
      if ((el.type && el.type === 'date') || /date/i.test(id)){
        const nv = normalizeDate(val);
        if (nv) el.value = nv; else el.value = '';
      } else {
        el.value = val || '';
      }
    } catch(e){ console.warn('expenses-bulk-loader: setVal failed', id, val, e); } };
    setVal('expenseDate', m.expenseDate);
    setVal('expenseFromDate', m.startDate || m.startDate);
    setVal('expenseToDate', m.endDate || m.endDate);
    setVal('expenseReference', m.reference || '');
    // selects: paidThrough, vendor, project, vatTreatment, placeOfSupply, isInclusiveTax
    const setSelectVal = (id, val) => {
      const el = document.getElementById(id); if (!el) return;
      let finalVal = val;
      if (id === 'expensePlaceOfSupply') finalVal = mapPlaceOfSupplyValue(val);
      if ([...el.options].some(o=>o.value===finalVal)) el.value = finalVal; else {
        // append option if not found
        const o = document.createElement('option'); o.value = finalVal || ''; o.textContent = finalVal || ''; el.appendChild(o); el.value = finalVal || ''; }
    };
    setSelectVal('expensePaidThrough', m.paidThrough);
    setSelectVal('expenseVendor', m.vendor);
    setSelectVal('expenseProjectName', m.projectName);
    setSelectVal('expenseVatTreatment', m.vatTreatment);
    setSelectVal('expensePlaceOfSupply', m.placeOfSupply);
    setSelectVal('expenseIsInclusiveTax', m.isInclusiveTax || '');

    // populate items
    const itemsBody = document.getElementById('expensesItemsBody'); if (!itemsBody) { console.warn('expenses-bulk-loader: items body not found'); return; }
    itemsBody.innerHTML = '';

    await ensureAccounts();

    group.items.forEach(it => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input class="expense-item-desc" value="${escapeHtml(it.description||'')}" placeholder="Description"></td>
        <td><select class="expense-item-account"></select></td>
        <td><input class="item-amount" type="number" step="any" value="${Number(it.amount||0).toFixed(2)}"></td>
        <td><input class="item-tax" type="number" step="any" value="${Number(it.tax||0).toFixed(2)}"></td>
        <td><div class="item-total">${Number(it.total|| (Number(it.amount||0)+Number(it.tax||0))).toFixed(2)}</div></td>
        <td><input class="item-ref" type="text" value="${escapeHtml(it.reference||'')}"></td>
        <td class="actions-col"><button type="button" class="remove-btn" title="Remove item">X</button></td>
      `;
      // populate accounts options
      const accSel = tr.querySelector('.expense-item-account');
      if (Array.isArray(window.expenseAccounts) && window.expenseAccounts.length) {
        accSel.innerHTML = '<option value="">-- Select Account --</option>' + window.expenseAccounts.map(a => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('');
        if (it.account) accSel.value = it.account;
      } else { accSel.innerHTML = '<option value="">-- Select Account --</option>'; }

      const amt = tr.querySelector('.item-amount'); const tax = tr.querySelector('.item-tax');
      const recalc = () => { const a = parseFloat(amt.value) || 0; const t = parseFloat(tax.value) || 0; const totEl = tr.querySelector('.item-total'); if (totEl) totEl.textContent = Number(a+t).toFixed(2); updateGrandTotal(); };
      amt.addEventListener('input', recalc); tax.addEventListener('input', recalc);
      tr.querySelector('.remove-btn').addEventListener('click', () => { tr.remove(); updateGrandTotal(); });
      itemsBody.appendChild(tr);
    });

    // update nav index if present
    const navIndexEl = document.querySelector('.nav-index'); if (navIndexEl && typeof group._navPos === 'number' && typeof group._navTotal === 'number') navIndexEl.textContent = `${group._navPos+1} / ${group._navTotal}`;
    // ensure totals
    updateGrandTotal();
  }

  // small helper to compute grand total (reuse modal function if present)
  function updateGrandTotal(){
    const itemsBody = document.getElementById('expensesItemsBody'); if (!itemsBody) return;
    const rows = Array.from(itemsBody.querySelectorAll('tr'));
    let g = 0; rows.forEach(r => { const t = parseFloat((r.querySelector('.item-total')||{}).textContent) || 0; g += t; });
    const grand = document.getElementById('expensesGrandTotal'); if (grand) grand.textContent = Number(g).toFixed(2);
    const emptyMsg = document.getElementById('expensesEmptyMsg'); if (emptyMsg) emptyMsg.style.display = rows.length ? 'none' : 'block';
  }

  // Public loader: fetch, group, and render first group; also wire nav buttons
  async function loadAndRenderExpenses(opts){
    opts = opts || {};
    const sheetId = opts.sheetId || window.GOOGLE_SPREADSHEET_ID || '1PLxaoFIZC4LEqFf7kJI1tQNOrGfFsEOjn6kt3QB30HU';
    const range = opts.range || 'Expenses!A2:AQ500';
    const statusEl = opts.statusEl || document.getElementById('expensesSaveStatus');
    try {
      if (statusEl) statusEl.textContent = '⏳ Loading expenses...';
      const rows = await fetchRows(sheetId, range);
      const groups = groupRows(rows);
      // attach navigation metadata
      groups.forEach((g,i) => { g._navPos = i; g._navTotal = groups.length; });
      window.expenseGroups = groups;
      console.log('expenses-bulk-loader: groups ready', groups.length);
      // open modal and render first
      if (typeof window.openExpensesManager === 'function') { window.openExpensesManager(); await new Promise(r=>setTimeout(r,120)); }
      if (groups.length) {
        await renderGroupToModal(groups[0]);
        // wire prev/next
        const prevBtn = document.querySelector('.prev-btn'); const nextBtn = document.querySelector('.next-btn'); const navIndexEl = document.querySelector('.nav-index');
        let cur = 0;
        if (navIndexEl) navIndexEl.textContent = `${cur+1} / ${groups.length}`;
        if (prevBtn) prevBtn.onclick = async () => { cur = Math.max(0, cur-1); await renderGroupToModal(groups[cur]); if (navIndexEl) navIndexEl.textContent = `${cur+1} / ${groups.length}`; };
        if (nextBtn) nextBtn.onclick = async () => { cur = Math.min(groups.length-1, cur+1); await renderGroupToModal(groups[cur]); if (navIndexEl) navIndexEl.textContent = `${cur+1} / ${groups.length}`; };
      } else {
        console.log('expenses-bulk-loader: no groups found');
      }
      if (statusEl) statusEl.textContent = '';
      return groups;
    } catch (e) {
      if (statusEl) statusEl.textContent = `⚠️ ${e.message}`;
      console.warn('expenses-bulk-loader: loadAndRenderExpenses failed', e);
      throw e;
    }
  }

  function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  window.expensesBulkLoader = { loadAndRenderExpenses, fetchRows, groupRows, renderGroupToModal };

})();
