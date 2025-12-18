// reports.js — Reports modal and unpaid-invoices summary
(function(){
  'use strict';

  function el(id){ return document.getElementById(id); }

  function parseNumber(v){
    if (v === null || v === undefined) return 0;
    if (typeof v === 'number' && !isNaN(v)) return v;
    let s = String(v || '').trim();
    if (!s) return 0;
    // Detect parentheses as negative numbers: (1,020.00) => -1020.00
    const parenNeg = /^\(.*\)$/.test(s);
    // Remove common markup and non-breaking spaces
    s = s.replace(/\u00A0/g,' ').replace(/[\u0000-\u001f\u007f-\u009f]/g, '');
    // Remove anything that's not a digit, dot, minus or percent sign (we keep % to detect percent if caller wants)
    // but we will remove % for numeric parsing here
    // Preserve leading '-' if present
    const negative = s.indexOf('-') !== -1 || parenNeg;
    // remove everything except digits, dot and minus
    s = s.replace(/[^0-9.\-]/g,'');
    if (!s) return 0;
    // If there are multiple dots, keep only the first and drop the rest
    const parts = s.split('.');
    if (parts.length > 2) s = parts.shift() + '.' + parts.join('');
    const n = parseFloat(s);
    if (isNaN(n)) return 0;
    return negative ? -Math.abs(n) : n;
  }

  // Try parse a value that might be a percentage (like '5%' or ' 5 %')
  function parsePercent(v){
    if (v === null || v === undefined) return { value: 0, isPercent: false };
    const raw = String(v).trim();
    if (raw.indexOf('%') !== -1) {
      // strip everything except digits, dot and minus
      const cleaned = raw.replace(/[^0-9.\-]/g,'');
      const n = parseFloat(cleaned);
      return { value: isNaN(n) ? 0 : n, isPercent: true };
    }
    return { value: null, isPercent: false };
  }

  // Find the first object key whose name matches any of the candidate substrings (case-insensitive, spaces/underscores ignored)
  function findKeyByParts(obj, parts){
    if (!obj || typeof obj !== 'object') return null;
    const keys = Object.keys(obj || {});
    const normParts = (parts || []).map(p => String(p||'').toLowerCase().replace(/[^a-z0-9]+/g,''));
    for (const k of keys){
      const nk = String(k||'').toLowerCase().replace(/[^a-z0-9]+/g,'');
      for (const p of normParts) if (p && nk.indexOf(p) !== -1) return k;
    }
    return null;
  }

  // Try candidates in order but avoid keys that contain any excluded substrings
  function findKeyWithExcludes(obj, candidates, excludes){
    const keys = Object.keys(obj || {});
    const normExcludes = (excludes || []).map(e => String(e||'').toLowerCase().replace(/[^a-z0-9]+/g,''));
    // first try exact/strong candidates in order
    for (const c of candidates){
      const nkc = String(c||'').toLowerCase().replace(/[^a-z0-9]+/g,'');
      for (const k of keys){
        const nk = String(k||'').toLowerCase().replace(/[^a-z0-9]+/g,'');
        if (nk === nkc){
          // ensure we don't pick a key containing exclude tokens
          if (normExcludes.some(ex => nk.indexOf(ex) !== -1)) continue;
          return k;
        }
      }
    }
    // fallback to substring match but still exclude bad keys
    for (const c of candidates){
      const nkc = String(c||'').toLowerCase().replace(/[^a-z0-9]+/g,'');
      for (const k of keys){
        const nk = String(k||'').toLowerCase().replace(/[^a-z0-9]+/g,'');
        if (nk.indexOf(nkc) !== -1){ if (normExcludes.some(ex => nk.indexOf(ex) !== -1)) continue; return k; }
      }
    }
    return null;
  }

  // Choose a friendly fallback string value from the row (first non-empty string value that's not numeric)
  function pickFallbackStringValue(obj){
    if (!obj || typeof obj !== 'object') return '';
    for (const k of Object.keys(obj)){
      const v = obj[k];
      if (v === null || v === undefined) continue;
      if (typeof v === 'string' && v.trim()){
        // skip obviously numeric strings like '150.00' or '1'
        if (/^[\d\s,\.\-]+$/.test(v.trim())) continue;
        return v.trim();
      }
    }
    return '';
  }

  function formatNumber(n){
    const num = (typeof n === 'number' ? n : parseNumber(n));
    try {
      return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
    } catch(e){
      return num.toFixed(2);
    }
  }

  function closeReportsModal(){
    const m = el('reportsModal'); if (!m) return; m.style.display = 'none'; document.body.style.overflow='auto';
  }

  function openReportsModal(){
    const m = el('reportsModal'); if (!m) return; m.style.display = 'flex'; document.body.style.overflow='hidden';
    populateReportsClientSelect();
    refreshReportsModal();
  }

  function getUniqueClients(){
    try {
      const clients = Array.isArray(window.clientsData) ? window.clientsData : [];
      const fromClients = clients.map(c => ({
        name: (c['Company Name']||c['Display Name']||c['Name']||c['company_name']||c['display_name']||'').trim(),
        status: (c['Status']||c['status']||'').toString().trim()
      })).filter(Boolean);

      // If contacts/clients include a Status column, restrict to those marked Active
      const hasStatus = fromClients.some(c => c.status !== '');
      let activeClients = [];
      const showInactiveGlobally = (window.settings && typeof window.settings.loadShowInactive === 'function') ? window.settings.loadShowInactive() : (localStorage.getItem('app_settings_showInactiveClients') === '1');
      if (hasStatus && !showInactiveGlobally) {
        activeClients = fromClients.filter(c => String(c.status).trim().toLowerCase() === 'active').map(c => c.name).filter(Boolean);
      } else {
        // either no status column or user wants to include inactive clients — include all names
        activeClients = fromClients.map(c => c.name).filter(Boolean);
      }
      // (hasStatus handled above; if not, activeClients already set to all names in the else branch)

      // If no client contacts available, fall back to unique names derived from invoices
      const fromInv = Array.isArray(window.allInvoices) ? Array.from(new Set(window.allInvoices.map(i => (i['Customer Name']||i['Client Name']||'').trim()).filter(Boolean))) : [];
      // build a map of contact statuses (normalized) from clients so we can filter invoice-derived names
      const clientStatusMap = {};
      fromClients.forEach(c => {
        try { if (c.name) clientStatusMap[String(c.name).toLowerCase().trim()] = String(c.status||'').toLowerCase().trim(); } catch(e){}
      });

      // combine client lists and ensure unique
      const allSet = new Set(activeClients.length > 0 ? activeClients : fromInv);
      // ensure invoices-only names are included as well
      fromInv.forEach(n => allSet.add(n));
      let all = Array.from(allSet);

      // compute frequency map from invoices (case-insensitive) so we can sort by occurrence
      const counts = {};
      if (Array.isArray(window.allInvoices)) {
        window.allInvoices.forEach(r => {
          const n = String(r['Customer Name']||r['Client Name']||'').trim();
          if (!n) return;
          const key = n.toLowerCase();
          counts[key] = (counts[key] || 0) + 1;
        });
      }

      // If we have contact statuses available and the user didn't ask to show inactive clients,
      // exclude invoice-derived clients that match a contact with a non-active status.
      if (!showInactiveGlobally && Object.keys(clientStatusMap).length > 0) {
        all = all.filter(n => {
          const k = String(n||'').toLowerCase().trim();
          const s = clientStatusMap[k];
          if (typeof s === 'string' && s.length > 0) return s === 'active';
          return true; // keep if no status recorded for that name
        });
      }

      // If filtering by contact status removed everything, but we have invoice-derived names,
      // fall back to showing invoice-derived names (so reports never show an empty client list)
      if (all.length === 0 && fromInv && fromInv.length > 0) {
        // replace with invoice-derived names as fallback
        all = Array.from(new Set(fromInv));
      }

      // sort primarily by invoice occurrence descending, then by name
      all.sort((a,b)=>{
        const ca = counts[String(a||'').toLowerCase()] || 0;
        const cb = counts[String(b||'').toLowerCase()] || 0;
        if (cb - ca !== 0) return cb - ca; // highest first
        return String(a||'').localeCompare(String(b||''));
      });
      return all;
    } catch(e){ return []; }
  }

  function populateReportsClientSelect(){
    const sel = el('reportsClientSelect'); if (!sel) return;
    sel.innerHTML = '';
    const optAll = document.createElement('option'); optAll.value = '__ALL__'; optAll.textContent = 'All clients (show all unpaid invoices)'; sel.appendChild(optAll);
    const clients = getUniqueClients();
    clients.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; sel.appendChild(o); });
    try { sel.onchange = refreshReportsModal; } catch(e){}
  }

  // Compute invoice total from invoice rows
  function computeInvoiceTotal(invoiceNumber){
    const rows = (window.allInvoices || []).filter(r => String(r['Invoice Number']||'').trim() === String(invoiceNumber||'').trim());
    if (!rows || !rows.length) return 0;
    
    // ALWAYS prefer the Total column from the invoice table (columns 16)
    // Try to find the Total column value from the first row
    const invoiceTotalCandidateKeys = ['Total', 'Invoice Total', 'Amount', 'Invoice Amount', 'Grand Total'];
    let invoiceTotalVal = NaN;
    
    for (const r of rows) {
      for (const k of Object.keys(r||{})){
        const nk = String(k||'').toLowerCase().replace(/[^a-z0-9]+/g,'');
        if (invoiceTotalCandidateKeys.some(pk => nk === pk.toLowerCase().replace(/[^a-z0-9]+/g,''))){
          invoiceTotalVal = parseNumber(r[k]);
          if (!isNaN(invoiceTotalVal) && invoiceTotalVal !== 0) break;
        }
      }
      if (!isNaN(invoiceTotalVal) && invoiceTotalVal !== 0) break;
    }
    
    // If we found a Total column value, use it
    if (!isNaN(invoiceTotalVal) && invoiceTotalVal !== 0) {
      return invoiceTotalVal;
    }
    
    // Fallback: Compute invoice total from row data using the canonical formula
    // Total = (Quantity * Item Price) - Discount Amount + Item Tax Amount
    let t = 0;
    // tiny helper to detect genuine item rows (same heuristics used when rendering details)
    function isDetailRowForCompute(r){
      if (!r || typeof r !== 'object') return false;
      const descKeyLocal = findKeyWithExcludes(r, ['itemdesc','item description','itemdescription','item_name','itemname','description','desc','detail','details'], ['customer','client','billing','company','invoice','subtotal','total']);
      const descVal = descKeyLocal ? String(r[descKeyLocal]||'').trim() : pickFallbackStringValue(r);
      const qty = parseNumber(r['Quantity']||r['Qty']||r['quantity']||0);
      const ip = parseNumber(r['Item Price']||r['ItemPrice']||r['Price']||r['Rate']||r['Unit Price']||0);
      const itotal = parseNumber(r['Item Total']||r['ItemTotal']||r['Line Total']||r['LineTotal']||r['Line_Total']||0);
      const itax = parseNumber(r['Item Tax Amount']||r['Item Tax']||r['ItemTaxAmount']||r['Tax Amount']||r['Tax']||0);
      const hasItemNumeric = (qty !== 0) || (ip !== 0) || (itotal !== 0) || (itax !== 0);
      if (descVal && (descVal.replace(/\s+/g,'') !== '')) return true;
      if (hasItemNumeric) return true;
      return false;
    }

    // identify real item rows first
    const detailRows = rows.filter(isDetailRowForCompute);
    const useRows = detailRows.length ? detailRows : rows;

    useRows.forEach(r => {
      const taxable = parseNumber(r['Taxable Amount'] || r['Taxable'] || r['TaxableAmount'] || r['Taxable_Amount'] || r['TaxableAmt'] || '0');
      // Prefer explicit item tax amount keys (and exclude common non-amount keywords), or detect percent columns
      const taxKey = findKeyWithExcludes(r,
        ['item tax amount','itemtaxamount','item tax','itemtax','taxamount','tax','tax_amt'],
        ['inclusive','is','invoice','taxable','registration','id']
      );
      const taxPercentKey = findKeyWithExcludes(r, ['item tax %','item tax percent','itemtax%','tax %','taxpercent','tax_percent','taxpercent'], ['inclusive','is','invoice','taxable','registration','id']);
      const rawTaxField = taxKey ? r[taxKey] : (r['Item Tax Amount']||r['Item Tax']||r['Tax Amount']||r['Tax']||0);
      const pdetect = parsePercent(rawTaxField);
      let tax;
      if (pdetect.isPercent) {
        // compute percent-based tax using taxable (if available) or derive taxable from qty/price/discount
        let baseTaxable = parseNumber(r['Taxable Amount'] || r['Taxable'] || r['TaxableAmount'] || r['Taxable_Amount'] || r['TaxableAmt'] || 0);
        if (!baseTaxable || baseTaxable === 0) {
          const q = parseNumber(r['Quantity']||r['Qty']||r['quantity']||0);
          const pr = parseNumber(r['Item Price']||r['ItemPrice']||r['Price']||r['Rate']||r['Unit Price']||0);
          const disc = parseNumber(r['Discount Amount']||r['Discount']||0);
          baseTaxable = (q * pr) - disc;
        }
        tax = baseTaxable * (pdetect.value/100);
      } else if (taxPercentKey && r[taxPercentKey] !== undefined) {
        const pk = parsePercent(r[taxPercentKey]);
        if (pk.isPercent) {
          let baseTaxable = parseNumber(r['Taxable Amount'] || r['Taxable'] || r['TaxableAmount'] || r['Taxable_Amount'] || r['TaxableAmt'] || 0);
          if (!baseTaxable || baseTaxable === 0) {
            const q = parseNumber(r['Quantity']||r['Qty']||r['quantity']||0);
            const pr = parseNumber(r['Item Price']||r['ItemPrice']||r['Price']||r['Rate']||r['Unit Price']||0);
            const disc = parseNumber(r['Discount Amount']||r['Discount']||0);
            baseTaxable = (q * pr) - disc;
          }
          tax = baseTaxable * (pk.value/100);
        } else {
          tax = parseNumber(rawTaxField);
        }
      } else {
        tax = parseNumber(rawTaxField);
      }
      // Compute per-row amount using canonical columns
      const qty = parseNumber(r['Quantity'] || r['Qty'] || r['quantity'] || 0);
      // Don't use 'Exchange Rate' as price. Use the same key-finding logic as the UI renderer.
      const priceKey = findKeyWithExcludes(r, ['item price','itemprice','unitprice','price','rate','unit_cost'], ['exchange','exchangerate','exchange_rate']);
      let price = parseNumber(priceKey ? r[priceKey] : (r['Item Price']||r['ItemPrice']||r['Price']||r['Unit Price']||0));
      const originalPrice = price;
      const discount = parseNumber(r['Discount Amount'] || r['Discount'] || 0);
      let itemTax = tax; // already computed above (may be amount or derived from percent)

      // Detect explicit total fields on the row and prefer to infer price from explicit total
      const totalKey = findKeyWithExcludes(r, ['line_total','linetotal','line total','total','amount','lineamount','value'], ['discount','paid','payment','tax','qty','quantity','rate','price','subtotal']);
      // Prefer explicit per-line total fields (item/line totals). Avoid generic invoice-level
      // 'Total' or 'Amount' keys because many CSV exports repeat invoice totals on every row.
      const explicitCandidates = [];
      // Only treat explicit per-line total keys (don't pick an invoice-level 'Total')
      if (totalKey && r[totalKey] !== undefined) {
        const nk = String(totalKey||'').toLowerCase().replace(/[^a-z0-9]+/g,'');
        if (nk.indexOf('item') !== -1 || nk.indexOf('line') !== -1) explicitCandidates.push(r[totalKey]);
      }
      ['Item Total','ItemTotal','Item_Total','Line Total','LineTotal','Line_Total'].forEach(k => { if (r[k] !== undefined) explicitCandidates.push(r[k]); });
      let explicitTotalRow = NaN;
      // If we found no per-line explicit totals but price is missing, allow generic fields
      // (Total/Amount/Value) as a last-resort candidate so we can infer price from an explicit
      // row total when the row lacks per-unit price information.
      if ((!price || price === 0) && explicitCandidates.length === 0) {
        ['Line Total','LineTotal','Line_Total','Total','Amount','Value'].forEach(k => { if (r[k] !== undefined) explicitCandidates.push(r[k]); });
      }
      for (const c of explicitCandidates) {
        const v = parseNumber(c);
        if (!isNaN(v) && v !== 0) { explicitTotalRow = v; break; }
      }

      // If there is an explicit row total and price is missing OR the subtotal computed from price differs substantially,
      // infer price so totals align with explicit value (useful when per-unit price is incorrect in the CSV)
      if (!isNaN(explicitTotalRow) && qty > 0) {
        const computedFromPrice = (qty * price) - discount + itemTax;
        const diff = Math.abs(computedFromPrice - explicitTotalRow);
        const threshold = Math.max(0.005 * Math.abs(explicitTotalRow || 0), 0.5);
        // Only infer price when missing OR when the computed-from-price disagrees AND
        // the original price is itself inconsistent with the explicit row total.
        // This avoids forcing an inference in cases where the CSV puts a price equal to the
        // explicit total (commonly the case when prices are tax-inclusive).
        const origDiff = Math.abs(originalPrice - explicitTotalRow);
        const origThreshold = Math.max(0.005 * Math.abs(explicitTotalRow || 0), 0.5);
        if ((!price || price === 0) || (diff > threshold && origDiff > origThreshold)) {
          const inferred = (explicitTotalRow - itemTax + discount) / qty;
          if (!isNaN(inferred) && isFinite(inferred)) price = inferred;
        }
        try { if (window && window.DEBUG_REPORTS) console.debug('COMPUTE_TOTAL_ROW', { invoice: invoiceNumber, desc: r['Item Desc']||r['Item Description']||r['ItemName']||'', qty, originalPrice, price, discount, itemTax, explicitTotalRow, computedFromPrice, diff, threshold, origDiff, origThreshold }); } catch(e){}
      }

      const rowTotal = (qty * price) - discount + itemTax;
      t += rowTotal;
    });
    try { if (window && window.DEBUG_REPORTS) console.debug('COMPUTE_TOTAL', { invoiceNumber: invoiceNumber, total: t }); } catch(e){}
    return t;
  }

  function computePaidForInvoice(invoiceNumber){
    const payments = Array.isArray(window.paymentsData) ? window.paymentsData : (window.payments || []);
    const rows = payments.filter(p => String((p['Invoice Number']||'')).trim() === String(invoiceNumber||'').trim());
    return rows.reduce((acc, r) => acc + parseNumber(r['Amount']||r['Paid']||r['Payment Amount']||r['Amount Paid']||0), 0);
  }

  // Statuses considered unpaid per spec
  const UNPAID_STATUSES = new Set(['sent','draft','overdue']);

  function refreshReportsModal(){
    const sel = el('reportsClientSelect'); if (!sel) return;
    const client = sel.value || '__ALL__';
    // Collect invoices grouped by invoice number
    const invoices = {};
    (window.allInvoices || []).forEach(r => {
      const inv = String(r['Invoice Number']||'').trim();
      if (!inv) return;
      const cust = String(r['Customer Name']||r['Client Name']||'').trim();
      const status = String(r['Invoice Status']||r['Status']||'').trim();
      if (!invoices[inv]) invoices[inv] = { invoiceNumber: inv, customerName: cust, rows: [], status: status, invoiceDate: r['Invoice Date'] || '', dueDate: r['Due Date'] || '' };
      invoices[inv].rows.push(r);
      // prefer header values if present
      if (!invoices[inv].status && status) invoices[inv].status = status;
      if (!invoices[inv].invoiceDate && r['Invoice Date']) invoices[inv].invoiceDate = r['Invoice Date'];
      if (!invoices[inv].dueDate && r['Due Date']) invoices[inv].dueDate = r['Due Date'];
    });

    // Build results
    const list = [];
    Object.keys(invoices).forEach(invNo => {
      const it = invoices[invNo];
      const status = (it.status || '').trim();
      if (!status) return; // ignore unknown
      if (!UNPAID_STATUSES.has(String(status).toLowerCase())) return; // only unpaid statuses
      if (client !== '__ALL__' && String(it.customerName).trim().toLowerCase() !== String(client).trim().toLowerCase()) return;

      const total = computeInvoiceTotal(invNo);
      const paid = computePaidForInvoice(invNo);
      const outstanding = Math.max(total - paid, 0);
      // include original rows so we can show line-item details in the modal
      list.push({ invoiceNumber: invNo, invoiceDate: it.invoiceDate, dueDate: it.dueDate, status: status, total, paid, outstanding, customerName: it.customerName, rows: it.rows });
    });

    // Sort by due date (oldest first) then invoice number
    list.sort((a,b)=>{
      const ad = a.dueDate ? new Date(a.dueDate) : new Date(0);
      const bd = b.dueDate ? new Date(b.dueDate) : new Date(0);
      if (ad - bd !== 0) return ad - bd;
      return String(a.invoiceNumber).localeCompare(String(b.invoiceNumber));
    });

    // Render
    const tbody = el('reportsResultsTBody'); if (!tbody) return;
    tbody.innerHTML = '';
    let grandTotal = 0, grandOutstanding = 0, grandPaid=0;
    if (list.length === 0){
      const tr0 = document.createElement('tr');
      tr0.innerHTML = `<td style="padding:12px; text-align:center; color:#666;" colspan="9">No unpaid invoices found for the selected client/status.</td>`;
      tbody.appendChild(tr0);
    }

    list.forEach(item => {
      grandTotal += item.total; grandOutstanding += item.outstanding; grandPaid += item.paid;
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid #eee';
      // show a small toggle button in the leading column to reveal line item details
      tr.innerHTML = `
        <td style="padding:8px 6px; text-align:center;">
          <button class="reports-toggle btn btn-small" data-inv="${escapeHtml(item.invoiceNumber)}" title="Details" aria-label="Details"><i class="bi bi-list" aria-hidden="true"></i></button>
        </td>
        <td style="padding:8px 10px;">${escapeHtml(item.customerName || '')}</td>
        <td style="padding:8px 10px;">${escapeHtml(item.invoiceNumber)}</td>
        <td style="padding:8px 10px; text-align:right;">${formatNumber(item.total)}</td>
        <td style="padding:8px 10px;">${escapeHtml(item.invoiceDate||'')}</td>
        <td style="padding:8px 10px;">${escapeHtml(item.dueDate||'')}</td>
        <td style="padding:8px 10px;">${escapeHtml(item.status)}</td>
        <td style="padding:8px 10px; text-align:right;">${formatNumber(item.paid)}</td>
        <td style="padding:8px 10px; text-align:right;">${formatNumber(item.outstanding)}</td>
      `;
      tbody.appendChild(tr);

      // details row (hidden by default) - build an inner small table of line items
      const detailsTr = document.createElement('tr');
      detailsTr.className = 'reports-details';
      detailsTr.style.display = 'none';
      const detailsTd = document.createElement('td');
      detailsTd.colSpan = 9;
      detailsTd.style.padding = '8px 10px';
      detailsTd.style.background = '#fbfbfb';
      detailsTd.style.borderBottom = '1px solid #eee';

      // Build inner table for items
      // Only render genuine detail rows. Many CSV exports include invoice-level rows (SubTotal/Total)
      // repeated per invoice that are not real line items. Filter those out and keep rows that
      // contain at least one item-specific field: description, quantity, item price, item total or item tax amount.
      const allRows = Array.isArray(item.rows) ? item.rows : [];
      function isDetailRow(r){
        if (!r || typeof r !== 'object') return false;
        // detect description keys
        const descKeyLocal = findKeyWithExcludes(r, ['itemdesc','item description','itemdescription','item_name','itemname','description','desc','detail','details'], ['customer','client','billing','company','invoice','subtotal','total']);
        const descVal = descKeyLocal ? String(r[descKeyLocal]||'').trim() : pickFallbackStringValue(r);
        // numeric checks for item-specific fields
        const qty = parseNumber(r['Quantity']||r['Qty']||r['quantity']||0);
        const ip = parseNumber(r['Item Price']||r['ItemPrice']||r['Price']||r['Rate']||r['Unit Price']||0);
        const itotal = parseNumber(r['Item Total']||r['ItemTotal']||r['Line Total']||r['LineTotal']||r['Line_Total']||0);
        const itax = parseNumber(r['Item Tax Amount']||r['Item Tax']||r['ItemTaxAmount']||r['Tax Amount']||r['Tax']||0);
        // If any item-specific field is present/positive or description exists, treat as detail
        const hasItemNumeric = (qty !== 0) || (ip !== 0) || (itotal !== 0) || (itax !== 0);
        if (descVal && (descVal.replace(/\s+/g,'') !== '')) return true;
        if (hasItemNumeric) {
          // Ensure it's not an invoice header row (some CSVs store SubTotal/Total on header rows but not item fields)
          const headerTotal = parseNumber(r['SubTotal']||r['Sub Total']||r['SubTotalAmount']||0);
          const headerInvoiceTotal = parseNumber(r['Total']||r['Invoice Total']||0);
          // If this row contains only header totals and has no item-specific fields (itotal/ip/itax/qty==0) then skip.
          // Already guarded by hasItemNumeric, so if here we consider it a detail.
          return true;
        }
        return false;
      }
      const items = allRows.filter(isDetailRow);
      const innerTable = document.createElement('table');
      innerTable.style.width = '100%';
      innerTable.style.borderCollapse = 'collapse';
      innerTable.style.fontSize = '12px';
      innerTable.innerHTML = `
        <thead>
          <tr style="border-bottom:1px solid #eee; color:#666; font-weight:600;">
            <th style="padding:6px 8px; text-align:left; width:45%">Description</th>
            <th style="padding:6px 8px; text-align:right; width:10%">Quantity</th>
            <th style="padding:6px 8px; text-align:right; width:12%">Item Price</th>
            <th style="padding:6px 8px; text-align:right; width:12%">Discount Amount</th>
            <th style="padding:6px 8px; text-align:right; width:12%">Item Tax Amount</th>
            <th style="padding:6px 8px; text-align:right; width:9%">Total</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;

      const innerTbody = innerTable.querySelector('tbody');

      if (!items.length) {
        const r = document.createElement('tr');
        r.innerHTML = `<td style="padding:8px" colspan="6">No item detail rows available for this invoice.</td>`;
        innerTbody.appendChild(r);
      } else {
        items.forEach(row => {
          // determine description/qty/price/tax/lineTotal with fallbacks
          // Pick column for description flexibly — try common names first, then fall back to any non-numeric string cell
          let desc = '';
          // Prefer an exact "Item Desc"-like key first, avoid matching customer/client fields by mistake
          const descKey = findKeyWithExcludes(row, ['itemdesc','item description','itemdescription','item_name','itemname','description','desc','detail','details','service'], ['customer','client','billing','company']);
          if (descKey) desc = String(row[descKey]||'').trim();
          if (!desc) desc = pickFallbackStringValue(row);
          // Read exact column values from CSV - use exact column names as they appear in CSV header
          const qty = parseNumber(row['Quantity'] || 0);
          const price = parseNumber(row['Item Price'] || 0);
          const discount = parseNumber(row['Discount Amount'] || 0);
          const tax = parseNumber(row['Item Tax Amount'] || 0);
          
          // Compute the line total using the canonical formula: (qty * price) - discount + tax
          const lineTotal = (qty * price) - discount + tax;

          const r = document.createElement('tr');
          r.innerHTML = `<td style="padding:6px 8px; color:#222;">${escapeHtml(desc)}</td>
                         <td style="padding:6px 8px; text-align:right; color:#222;">${qty ? formatNumber(qty) : ''}</td>
                         <td style="padding:6px 8px; text-align:right; color:#222;">${formatNumber(price)}</td>
                         <td style="padding:6px 8px; text-align:right; color:#222;">${formatNumber(discount)}</td>
                         <td style="padding:6px 8px; text-align:right; color:#222;">${formatNumber(tax)}</td>
                         <td style="padding:6px 8px; text-align:right; color:#222;">${formatNumber(lineTotal)}</td>`;
          innerTbody.appendChild(r);
        });
      }

      detailsTd.appendChild(innerTable);
      detailsTr.appendChild(detailsTd);
      tbody.appendChild(detailsTr);
    });

    // Add click handlers to toggles so details rows open/close
    try {
      tbody.querySelectorAll('.reports-toggle').forEach(btn => {
        btn.addEventListener('click', function(e){
          try {
            const b = e.currentTarget;
            const row = b.closest('tr');
            const details = row.nextElementSibling && row.nextElementSibling.classList && row.nextElementSibling.classList.contains('reports-details') ? row.nextElementSibling : null;
            if (!details) return;
            const isHidden = details.style.display === 'none' || details.style.display === '';
            details.style.display = isHidden ? 'table-row' : 'none';
            b.innerHTML = isHidden ? `<i class="bi bi-list" aria-hidden="true"></i>` : `<i class="bi bi-list" aria-hidden="true"></i>`;
          } catch(err){ /* noop */ }
        });
      });
    } catch(e) { /* no-op */ }

    // Update inline totals in table footer
    try {
      const tTotal = el('reports_total'); if (tTotal) tTotal.textContent = formatNumber(grandTotal);
      const tPaid = el('reports_paid'); if (tPaid) tPaid.textContent = formatNumber(grandPaid);
      const tOut = el('reports_outstanding'); if (tOut) tOut.textContent = formatNumber(grandOutstanding);
    } catch(e){ /* no-op */ }
  }

  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;" })[c]); }

  // Attach to window
  window.showReports = openReportsModal;
  window.openReportsModal = openReportsModal;
  window.closeReportsModal = closeReportsModal;
  window.refreshReportsModal = refreshReportsModal;
  // expose helper to repopulate client select from settings/actions
  window.populateReportsClientSelect = populateReportsClientSelect;

  // allow Ctrl/Cmd+R to refresh modal contents quickly when open
  document.addEventListener('keydown', function(e){ if ((e.ctrlKey || e.metaKey) && e.key === 'r'){ const m = el('reportsModal'); if (m && m.style.display === 'flex'){ e.preventDefault(); refreshReportsModal(); } } });

  console.log('reports.js loaded');

})();
