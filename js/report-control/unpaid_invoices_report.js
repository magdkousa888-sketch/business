// unpaid_invoices_report.js - Unpaid Invoices Report Modal
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
    // Remove anything that's not a digit, dot, minus or percent sign
    const negative = s.indexOf('-') !== -1 || parenNeg;
    s = s.replace(/[^0-9.\-]/g,'');
    if (!s) return 0;
    // If there are multiple dots, keep only the first and drop the rest
    const parts = s.split('.');
    if (parts.length > 2) s = parts.shift() + '.' + parts.join('');
    const n = parseFloat(s);
    if (isNaN(n)) return 0;
    return negative ? -Math.abs(n) : n;
  }

  function formatNumber(n){
    const num = (typeof n === 'number' ? n : parseNumber(n));
    try {
      return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
    } catch(e){
      return num.toFixed(2);
    }
  }

  function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text || '').replace(/[&<>"']/g, m => map[m]);
  }

  // Find the first object key whose name matches any of the candidate substrings
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

  // Choose a friendly fallback string value from the row
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

  function closeReportsModal(){
    const m = el('reportsModal'); 
    if (!m) return; 
    m.style.display = 'none'; 
    document.body.style.overflow='auto';
  }

  function openReportsModal(){
    const m = el('reportsModal'); 
    if (!m) return; 
    m.style.display = 'flex'; 
    document.body.style.overflow='hidden';
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

      const hasStatus = fromClients.some(c => c.status !== '');
      let activeClients = [];
      const showInactiveGlobally = (window.settings && typeof window.settings.loadShowInactive === 'function') ? window.settings.loadShowInactive() : (localStorage.getItem('app_settings_showInactiveClients') === '1');
      
      if (hasStatus && !showInactiveGlobally) {
        activeClients = fromClients.filter(c => String(c.status).trim().toLowerCase() === 'active').map(c => c.name).filter(Boolean);
      } else {
        activeClients = fromClients.map(c => c.name).filter(Boolean);
      }

      const fromInv = Array.isArray(window.allInvoices) ? Array.from(new Set(window.allInvoices.map(i => (i['Customer Name']||i['Client Name']||'').trim()).filter(Boolean))) : [];
      const clientStatusMap = {};
      fromClients.forEach(c => {
        try { if (c.name) clientStatusMap[String(c.name).toLowerCase().trim()] = String(c.status||'').toLowerCase().trim(); } catch(e){}
      });

      const allSet = new Set(activeClients.length > 0 ? activeClients : fromInv);
      fromInv.forEach(n => allSet.add(n));
      let all = Array.from(allSet);

      const counts = {};
      if (Array.isArray(window.allInvoices)) {
        window.allInvoices.forEach(r => {
          const n = String(r['Customer Name']||r['Client Name']||'').trim();
          if (!n) return;
          const key = n.toLowerCase();
          counts[key] = (counts[key] || 0) + 1;
        });
      }

      if (!showInactiveGlobally && Object.keys(clientStatusMap).length > 0) {
        all = all.filter(n => {
          const k = String(n||'').toLowerCase().trim();
          const s = clientStatusMap[k];
          if (typeof s === 'string' && s.length > 0) return s === 'active';
          return true;
        });
      }

      if (all.length === 0 && fromInv && fromInv.length > 0) {
        all = Array.from(new Set(fromInv));
      }

      all.sort((a,b)=>{
        const ca = counts[String(a||'').toLowerCase()] || 0;
        const cb = counts[String(b||'').toLowerCase()] || 0;
        if (cb - ca !== 0) return cb - ca;
        return String(a||'').localeCompare(String(b||''));
      });
      return all;
    } catch(e){ return []; }
  }

  function populateReportsClientSelect(){
    const sel = el('reportsClientSelect'); 
    if (!sel) return;
    sel.innerHTML = '';
    const optAll = document.createElement('option'); 
    optAll.value = '__ALL__'; 
    optAll.textContent = 'All clients (show all unpaid invoices)'; 
    sel.appendChild(optAll);
    const clients = getUniqueClients();
    clients.forEach(c => { 
      const o = document.createElement('option'); 
      o.value = c; 
      o.textContent = c; 
      sel.appendChild(o); 
    });
    try { sel.onchange = refreshReportsModal; } catch(e){}
  }

  // Compute invoice total from invoice rows - use Total column from CSV
  function computeInvoiceTotal(invoiceNumber){
    const rows = (window.allInvoices || []).filter(r => String(r['Invoice Number']||'').trim() === String(invoiceNumber||'').trim());
    if (!rows || !rows.length) return 0;
    
    // ALWAYS prefer the Total column from the invoice table (column 12)
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
    
    if (!isNaN(invoiceTotalVal) && invoiceTotalVal !== 0) {
      return invoiceTotalVal;
    }
    
    return 0;
  }

  function computePaidForInvoice(invoiceNumber){
    const payments = Array.isArray(window.paymentsData) ? window.paymentsData : (window.payments || []);
    const rows = payments.filter(p => String((p['Invoice Number']||'')).trim() === String(invoiceNumber||'').trim());
    return rows.reduce((acc, r) => acc + parseNumber(r['Amount']||r['Paid']||r['Payment Amount']||r['Amount Paid']||0), 0);
  }

  // Statuses considered unpaid
  const UNPAID_STATUSES = new Set(['sent','draft','overdue']);

  function refreshReportsModal(){
    const sel = el('reportsClientSelect'); 
    if (!sel) return;
    const client = sel.value || '__ALL__';
    
    // Collect invoices grouped by invoice number
    const invoices = {};
    (window.allInvoices || []).forEach(r => {
      const inv = String(r['Invoice Number']||'').trim();
      if (!inv) return;
      const cust = String(r['Customer Name']||r['Client Name']||'').trim();
      const status = String(r['Invoice Status']||r['Status']||'').trim();
      if (!invoices[inv]) invoices[inv] = { 
        invoiceNumber: inv, 
        customerName: cust, 
        rows: [], 
        status: status, 
        invoiceDate: r['Invoice Date'] || '', 
        dueDate: r['Due Date'] || '' 
      };
      invoices[inv].rows.push(r);
      if (!invoices[inv].status && status) invoices[inv].status = status;
      if (!invoices[inv].invoiceDate && r['Invoice Date']) invoices[inv].invoiceDate = r['Invoice Date'];
      if (!invoices[inv].dueDate && r['Due Date']) invoices[inv].dueDate = r['Due Date'];
    });

    // Build results
    const list = [];
    Object.keys(invoices).forEach(invNo => {
      const it = invoices[invNo];
      const status = (it.status || '').trim();
      if (!status) return;
      if (!UNPAID_STATUSES.has(String(status).toLowerCase())) return;
      if (client !== '__ALL__' && String(it.customerName).trim().toLowerCase() !== String(client).trim().toLowerCase()) return;

      const total = computeInvoiceTotal(invNo);
      const paid = computePaidForInvoice(invNo);
      const outstanding = Math.max(total - paid, 0);
      list.push({ 
        invoiceNumber: invNo, 
        invoiceDate: it.invoiceDate, 
        dueDate: it.dueDate, 
        status: status, 
        total, 
        paid, 
        outstanding, 
        customerName: it.customerName, 
        rows: it.rows 
      });
    });

    // Sort by due date (oldest first) then invoice number
    list.sort((a,b)=>{
      const ad = a.dueDate ? new Date(a.dueDate) : new Date(0);
      const bd = b.dueDate ? new Date(b.dueDate) : new Date(0);
      if (ad - bd !== 0) return ad - bd;
      return String(a.invoiceNumber).localeCompare(String(b.invoiceNumber));
    });

    // Render
    const tbody = el('reportsResultsTBody'); 
    if (!tbody) return;
    tbody.innerHTML = '';
    let grandTotal = 0, grandOutstanding = 0, grandPaid=0;
    
    if (list.length === 0){
      const tr0 = document.createElement('tr');
      tr0.innerHTML = `<td style="padding:12px; text-align:center; color:#666;" colspan="9">No unpaid invoices found for the selected client/status.</td>`;
      tbody.appendChild(tr0);
    }

    list.forEach(item => {
      grandTotal += item.total; 
      grandOutstanding += item.outstanding; 
      grandPaid += item.paid;
      
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid #eee';
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

      // Details row (hidden by default)
      const detailsTr = document.createElement('tr');
      detailsTr.className = 'reports-details';
      detailsTr.style.display = 'none';
      const detailsTd = document.createElement('td');
      detailsTd.colSpan = 9;
      detailsTd.style.padding = '8px 10px';
      detailsTd.style.background = '#fbfbfb';
      detailsTd.style.borderBottom = '1px solid #eee';

      // Build inner table for items
      const allRows = Array.isArray(item.rows) ? item.rows : [];
      
      function isDetailRow(r){
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
          let desc = '';
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

    // Add click handlers to toggles
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
          } catch(err){ console.error(err); }
        });
      });
    } catch(e){}

    // Add click handlers to mark paid buttons
    try {
      tbody.querySelectorAll('.reports-mark-paid').forEach(btn => {
        btn.addEventListener('click', async function(e){
          try {
            const b = e.currentTarget;
            const inv = b.getAttribute('data-inv');
            if (!inv) return;
            const confirmed = window.confirm(`Mark invoice ${inv} as PAID?`);
            if (!confirmed) return;
            const rows = (window.allInvoices || []).filter(r => String(r['Invoice Number']||'').trim() === String(inv).trim());
            if (!rows.length) return;
            const total = computeInvoiceTotal(inv);
            const paid = computePaidForInvoice(inv);
            const outstanding = Math.max(total - paid, 0);
            rows.forEach(r => { r['Invoice Status'] = 'Paid'; r['Status'] = 'Paid'; });
            if (typeof window.saveInvoiceData === 'function') await window.saveInvoiceData();
            setTimeout(()=>{ 
              refreshReportsModal(); 
              if (typeof window.updatePaymentSummaryUI === 'function') window.updatePaymentSummaryUI(inv); 
              if (typeof window.alert === 'function') window.alert(`Invoice ${inv} marked as PAID (AED ${outstanding.toFixed(2)})`); 
            }, 10);
          } catch(err){ console.error(err); }
        });
      });
    } catch(e){}

    // Update grand totals
    const tfoot = el('reportsResultsTFoot');
    if (tfoot){
      tfoot.innerHTML = `
        <tr style="font-weight:600; border-top:2px solid #ddd;">
          <td colspan="3" style="padding:10px; text-align:right;">Grand Total:</td>
          <td style="padding:10px; text-align:right;">${formatNumber(grandTotal)}</td>
          <td colspan="3"></td>
          <td style="padding:10px; text-align:right;">${formatNumber(grandPaid)}</td>
          <td style="padding:10px; text-align:right;">${formatNumber(grandOutstanding)}</td>
        </tr>
      `;
    }
  }

  // Expose functions globally
  window.showReports = openReportsModal;
  window.closeReportsModal = closeReportsModal;
  window.refreshReportsModal = refreshReportsModal;

  // Setup keyboard shortcut (Ctrl+R to refresh)
  document.addEventListener('keydown', function(e){ 
    if ((e.ctrlKey || e.metaKey) && e.key === 'r'){ 
      const m = el('reportsModal'); 
      if (m && m.style.display === 'flex'){ 
        e.preventDefault(); 
        refreshReportsModal(); 
      } 
    } 
  });

})();
