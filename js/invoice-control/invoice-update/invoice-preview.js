// Invoice Preview Modal (cloned structure from bundle UI)
(function(){
  'use strict';

  function formatDateForInput(s) {
    const str = String(s || '').trim();
    if (!str) return '';
    // Already ISO
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    // d/m/yyyy or dd/mm/yyyy or with -
    const m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m) {
      const dd = m[1].padStart(2, '0');
      const mm = m[2].padStart(2, '0');
      const yyyy = m[3];
      return `${yyyy}-${mm}-${dd}`;
    }
    // Try Date.parse
    const parsed = new Date(str);
    if (!isNaN(parsed)) return parsed.toISOString().slice(0,10);
    return '';
  }

  // Ensure numeric strings are suitable for `input[type=number]` values (remove thousands separators, currency symbols)
  function sanitizeNumericForInput(v) {
    if (v == null) return '';
    let s = String(v).trim();
    if (s === '-') return '-'; // preserve explicit dash
    // Parentheses indicate negative numbers: (1,234.00) -> -1234.00
    let negative = false;
    if (/^\(.*\)$/.test(s)) { negative = true; s = s.replace(/^\(|\)$/g, ''); }
    // Strip out currency symbols/letters but keep digits, dots, commas, minus
    s = s.replace(/[^0-9.,\-]/g, '');
    // Handle mixed separators: if both dot and comma present decide which is decimal
    if (s.indexOf('.') !== -1 && s.indexOf(',') !== -1) {
      if (s.lastIndexOf('.') < s.lastIndexOf(',')) {
        // format like 1.234,56 -> remove dots, convert comma to dot
        s = s.replace(/\./g, '').replace(/,/g, '.');
      } else {
        // format like 1,234.56 -> remove commas
        s = s.replace(/,/g, '');
      }
    } else if (s.indexOf(',') !== -1) {
      // Only commas present: decide if comma is decimal separator (eg 1234,56) or thousands
      const parts = s.split(',');
      if (parts.length === 2 && parts[1].length <= 3) {
        s = parts[0] + '.' + parts[1];
      } else {
        s = s.replace(/,/g, '');
      }
    }
    // Remove any remaining invalid chars
    s = s.replace(/[^0-9.\-]/g, '');
    if (negative) s = '-' + s;
    return s;
  }

  // options: { allowUpdate: boolean }
  function openInvoicePreviewModal(invoiceNumber, options) {
    options = options || {};
    const allowUpdate = !!options.allowUpdate;
    if (!invoiceNumber) invoiceNumber = (document.getElementById('invoiceNumber') && document.getElementById('invoiceNumber').value) || '';
    if (!invoiceNumber) { alert('No invoice selected'); return; }

    // Gather invoice metadata
    const invoiceDate = document.getElementById('invoiceDate') ? document.getElementById('invoiceDate').value : '';
    const invoiceStatus = document.getElementById('invoiceStatusDropdown') ? (document.getElementById('invoiceStatusDropdown').value || '') : '';
    const customerName = document.getElementById('clientNameDisplay') ? (document.getElementById('clientNameDisplay').textContent || '') : '';
    const isInclusiveTax = (function(){ const el = document.getElementById('isInclusiveTax'); return el ? (el.checked ? 'TRUE' : 'FALSE') : ''; })();
    const dueDate = document.getElementById('dueDate') ? document.getElementById('dueDate').value : '';
    const discountType = (document.getElementById('discountType') && (document.getElementById('discountType').value || '')) || 'item_level';
    const terms = document.getElementById('terms') ? document.getElementById('terms').value : '';

    // Collect items
    const tbody = document.getElementById('itemsTable');
    const domRows = tbody ? Array.from(tbody.querySelectorAll('tr')) : [];
    const items = domRows.map(tr => {
      const itemName = tr.querySelector('.item-name') ? (tr.querySelector('.item-name').value || '') : (tr.querySelector('.name-input') ? (tr.querySelector('.name-input').value || '') : '');
      const itemDesc = tr.querySelector('.desc-input') ? (tr.querySelector('.desc-input').value || '') : '';
      const qty = tr.querySelector('.qty-input') ? (tr.querySelector('.qty-input').value || '') : (tr.querySelector('.quantity-input') ? (tr.querySelector('.quantity-input').value || '') : '1');
      const discount = tr.querySelector('.discount-input') ? (tr.querySelector('.discount-input').value || '') : '';
      const itemPrice = tr.querySelector('.rate-input') ? (tr.querySelector('.rate-input').value || '') : '';
      const taxable = tr.querySelector('.taxable-amount') ? sanitizeNumericForInput(tr.querySelector('.taxable-amount').textContent || '') : '';
      const itemTotal = taxable || (function(){ const q = parseFloat(qty)||0; const p = parseFloat(itemPrice)||0; const d = parseFloat(discount)||0; return (Math.max(0, q*p - d)).toFixed(2); })();
      const vatPercent = tr.querySelector('.tax-percent-input') ? (tr.querySelector('.tax-percent-input').value || '') : '';
      const itemTaxAmount = tr.querySelector('.tax-amount') ? (tr.querySelector('.tax-amount').textContent || '') : '';
      return { itemName, itemDesc, qty, discount, itemTotal, itemPrice, vatPercent, itemTaxAmount };
    });

    const vatTreatment = document.getElementById('vatTreatmentDropdown') ? (document.getElementById('vatTreatmentDropdown').value || '') : '';
    const placeOfSupply = document.getElementById('emirateDropdown') ? (document.getElementById('emirateDropdown').value || '') : '';
    const trn = document.getElementById('clientTRNDisplay') ? (document.getElementById('clientTRNDisplay').textContent || '').replace(/^TRN\s*/i,'') : '';

    // Build modal overlay using the bundles modal id so it inherits the same CSS
    const overlay = document.createElement('div'); overlay.className = 'modal-overlay'; overlay.id = 'bundlesModalOverlay'; overlay.dataset.preview = 'invoice';
    const content = document.createElement('div'); content.className = 'modal-content';

    // Header (match bundle header controls: prev/next/nav + close)
    const header = document.createElement('div'); header.className = 'modal-header';
    header.innerHTML = `
      <h3>Invoice Preview</h3>
      <div class="header-controls">
        <button type="button" class="btn prev-btn" title="Previous">Prev</button>
        <button type="button" class="btn nav-index" aria-hidden="true">0 / 0</button>
        <button type="button" class="btn next-btn" title="Next">Next</button>
        <button class="modal-close" title="Close">&times;</button>
      </div>
    `;
    content.appendChild(header);

    // Body (form-grid + table-scroll identical structure to bundles modal)
    const body = document.createElement('div'); body.className = 'modal-body';

    const metaGrid = document.createElement('div'); metaGrid.className = 'form-grid';
    metaGrid.id = 'invoicePreviewMeta';
    body.appendChild(metaGrid);

    const tableWrap = document.createElement('div'); tableWrap.className = 'table-scroll';
    const table = document.createElement('table'); table.className = 'bundle-items-table invoice-preview-table';
    table.innerHTML = `
        <thead>
          <tr>
            <th style="width:2%;">#</th>
            <th style="width:42%;">Description</th>
            <th style="width:6%;">Qty</th>
            <th style="width:8%;">Rate</th>
            <th style="width:8%;">Discount</th>
            <th style="width:12%;">Taxable Amount</th>
            <th style="width:12%;">Tax Amount</th>
            <th style="width:6%">Tax %</th>
            <th style="width:10%;">Total</th>
            <th style="width:2%;"></th>
          </tr>
        </thead>
      </thead>
      <tbody id="invoicePreviewItemsBody"></tbody>
    `;
    tableWrap.appendChild(table);
    body.appendChild(tableWrap);

    // Table actions / grand total row area
    const tableActions = document.createElement('div'); tableActions.className = 'table-actions';
    tableActions.innerHTML = `<div><button type="button" class="btn add-line-btn" id="invoicePreview_addItem">Add Item</button></div><div class="grand-total">Grand Total: <span id="invoicePreviewGrandTotal">0.00</span></div>`;
    body.appendChild(tableActions);

    // Bottom terms area (always present, kept in sync with meta terms textarea)
    const termsBottomContainer = document.createElement('div'); termsBottomContainer.className = 'notes-row'; termsBottomContainer.id = 'invoicePreview_termsBottomContainer';
    termsBottomContainer.innerHTML = `<label>Terms & Conditions</label><textarea id="invoicePreview_termsBottom" style="width:100%; height: 90px;"></textarea>`;
    body.appendChild(termsBottomContainer);

    content.appendChild(body);

    // Actions
    const actions = document.createElement('div');
    // Left side (Cancel + Save)
    const left = document.createElement('div'); left.className = 'action-bar';
    const cancelBtnEl = document.createElement('button'); cancelBtnEl.className = 'cancel-btn btn'; cancelBtnEl.textContent = 'Close';
    const saveBtnEl = document.createElement('button'); saveBtnEl.className = 'btn btn-append'; saveBtnEl.id = 'invoicePreview_saveBtn'; saveBtnEl.textContent = 'Save Changes';
    left.appendChild(cancelBtnEl); left.appendChild(saveBtnEl);
    actions.appendChild(left);

    // Right side (optional update)
    const right = document.createElement('div');
    if (allowUpdate) {
      const confirmBtn = document.createElement('button'); confirmBtn.className = 'btn btn-success'; confirmBtn.id = 'confirmInvoicePreviewUpdate'; confirmBtn.textContent = 'Confirm & Update';
      right.appendChild(confirmBtn);
    }
    actions.appendChild(right);
    content.appendChild(actions);

    // Append overlay and show
    document.body.appendChild(overlay);
    overlay.appendChild(content);
    document.body.style.overflow = 'hidden';

    // Hook up header navigation and close
    const prevBtn = header.querySelector('.prev-btn');
    const nextBtn = header.querySelector('.next-btn');
    const navIndexEl = header.querySelector('.nav-index');
    const closeBtn = header.querySelector('.modal-close'); if (closeBtn) closeBtn.onclick = closeInvoicePreviewModal;

    // Close/Cancel handlers
    const cancelBtn = actions ? actions.querySelector('.cancel-btn') : null;
    // prefer local element if present
    const cancelToUse = cancelBtnEl || cancelBtn;
    if (cancelToUse) cancelToUse.onclick = closeInvoicePreviewModal;

    // Render helper that sources from `window.allInvoices` where possible
    function renderPreview(invNum) {
      const rows = Array.isArray(window.allInvoices) ? window.allInvoices.filter(r => String(r['Invoice Number']||r['invoice number']||'').trim() === String(invNum).trim()) : [];
      let meta = {};
      let itemsToRender = [];
      if (rows.length > 0) {
        const first = rows[0];
        meta = {
          invoiceDate: first['Invoice Date'] || first['invoice date'] || '',
          invoiceNumber: first['Invoice Number'] || first['invoice number'] || invNum,
          invoiceStatus: first['Invoice Status'] || first['invoice status'] || '',
          customerName: first['Customer Name'] || first['Customer'] || first['client name'] || '',
          isInclusiveTax: first['Is Inclusive Tax'] || first['is inclusive tax'] || '',
          dueDate: first['Due Date'] || first['due date'] || '',
          discountType: first['Discount Type'] || first['discount type'] || '',
          paymentTerms: first['Payment Terms'] || first['payment terms'] || '',
          paymentTermsLabel: first['Payment Terms Label'] || first['payment terms label'] || '',
          terms: first['Terms & Conditions'] || first['Terms and Conditions'] || first['terms & conditions'] || ''
        };
        itemsToRender = rows.map(r => ({
          itemName: r['Item Name'] || r['Item name'] || r['ItemName'] || '',
          itemDesc: r['Item Desc'] || r['Item Desc'] || r['Item Description'] || '',
          qty: r['Quantity'] || r['Qty'] || r['quantity'] || '',
          discount: r['Discount Amount'] || r['Discount'] || '',
          itemTotal: r['Item Total'] || r['ItemTotal'] || r['Item Total Amount'] || '',
          itemPrice: r['Item Price'] || r['ItemPrice'] || '',
          vatTreatment: r['VAT Treatment'] || r['VAT'] || '',
          placeOfSupply: r['Place Of Supply'] || r['Place of supply'] || '',
          trn: r['Tax Registration Number'] || r['Tax Registration No'] || '',
          itemTaxPercent: r['Item Tax %'] || r['Item Tax %'] || r['item tax %'] || '',
          itemTaxAmount: r['Item Tax Amount'] || r['item tax amount'] || ''
        }));
      } else {
        // Fallback: if invoice is current DOM, use DOM values collected earlier
        meta = { invoiceDate, invoiceNumber, invoiceStatus, customerName, isInclusiveTax, dueDate, discountType, terms };
        itemsToRender = items.map(it => ({ itemName: it.itemName, itemDesc: it.itemDesc, qty: it.qty, discount: it.discount, itemTotal: it.itemTotal, itemPrice: it.itemPrice, vatTreatment, placeOfSupply, trn, itemTaxPercent: it.vatPercent, itemTaxAmount: it.itemTaxAmount }));
      }

      // Populate meta grid
      const metaEl = document.getElementById('invoicePreviewMeta');
      const metaVatTreatment = (rows.length > 0) ? (rows[0]['VAT Treatment'] || rows[0]['vat treatment'] || '') : vatTreatment || '';
      const metaPlace = (rows.length > 0) ? (rows[0]['Place Of Supply'] || rows[0]['place of supply'] || '') : placeOfSupply || '';
      const metaTrn = (rows.length > 0) ? (rows[0]['Tax Registration Number'] || rows[0]['Tax Registration No'] || '') : trn || '';
      if (metaEl) {
        // Make meta fields editable inputs so user can change values in the preview
        metaEl.innerHTML = `
          <div><label>Invoice Date</label><div><input type="date" id="invoicePreview_invoiceDate" value="${escapeHtml(formatDateForInput(meta.invoiceDate || ''))}"></div></div>
          <div><label>Invoice Number</label><div><input type="text" id="invoicePreview_invoiceNumber" value="${escapeHtml(meta.invoiceNumber || '')}" readonly></div></div>
          <div><label>Invoice Status</label><div><select id="invoicePreview_invoiceStatus" style="width:100%"></select></div></div>
          <div><label>Customer Name</label><div><select id="invoicePreview_clientDropdown" style="width:100%"></select></div></div>
          <div hidden><label>Is Inclusive Tax</label><div>
            <select id="invoicePreview_isInclusiveTax" style="width:100%">
              <option value="True"${meta.isInclusiveTax && String(meta.isInclusiveTax).toLowerCase() !== 'false' ? ' selected' : ''}>True</option>
              <option value="False"${!meta.isInclusiveTax || String(meta.isInclusiveTax).toLowerCase() === 'false' ? ' selected' : ''}>False</option>
            </select>
          </div></div >
          <div><label>Due Date</label><div><input type="date" id="invoicePreview_dueDate" value="${escapeHtml(formatDateForInput(meta.dueDate || ''))}"></div></div>
          <div><label>Payment Terms</label><div><input type="text" id="invoicePreview_paymentTerms" value="${escapeHtml(meta.paymentTermsLabel || meta.paymentTerms || '')}"></div></div>
          <div hidden><label>Discount Type</label><div><input type="text" id="invoicePreview_discountType" value="${escapeHtml(meta.discountType || '')}"></div></div>
          <div><label>VAT Treatment</label><div><input type="text" id="invoicePreview_vatTreatment" value="${escapeHtml(metaVatTreatment)}"></div></div>
          <div><label>Place Of Supply</label><div><select id="invoicePreview_placeOfSupply" style="width:100%"></select></div></div>
          <div><label>Tax Registration Number</label><div><input type="text" id="invoicePreview_trn" value="${escapeHtml(metaTrn)}"></div></div>
        `;
        // Populate client dropdown in preview using clientManager helper if available
        try {
          const previewSelect = document.getElementById('invoicePreview_clientDropdown');
          if (previewSelect) {
            previewSelect.innerHTML = '';
            if (window.clientManager && typeof window.clientManager.getVisibleClientsSortedByInvoiceFrequency === 'function') {
              const rows = window.clientManager.getVisibleClientsSortedByInvoiceFrequency();
              const opt = document.createElement('option'); opt.value = ''; opt.textContent = '-- Select a client --'; previewSelect.appendChild(opt);
              rows.forEach(r => { const o = document.createElement('option'); o.value = r.index; o.textContent = r.name; previewSelect.appendChild(o); });
              // try to select current client if visible
              const curName = String(meta.customerName || '').trim().toLowerCase();
              if (curName) {
                let selIndex = Array.from(previewSelect.options).findIndex(o => (o.textContent || '').toLowerCase().trim() === curName);
                if (selIndex !== -1) previewSelect.selectedIndex = selIndex;
              }
            } else if (document.getElementById('clientDropdown')) {
              // fallback: clone options from main client dropdown
              const main = document.getElementById('clientDropdown');
              Array.from(main.options).forEach(o => previewSelect.appendChild(o.cloneNode(true)));
              // set selection by displayed name
              const curName = String(meta.customerName || '').trim().toLowerCase();
              if (curName) {
                let selIndex = Array.from(previewSelect.options).findIndex(o => (o.textContent || '').toLowerCase().trim() === curName);
                if (selIndex !== -1) previewSelect.selectedIndex = selIndex;
              }
            }

            previewSelect.addEventListener('change', (e) => {
              const v = previewSelect.value;
              if (v === '') return;
              const client = (window.clientsData && window.clientsData[v]) ? window.clientsData[v] : null;
              if (client) {
                // Update TRN, VAT Treatment, Place Of Supply fields in modal
                const trnVal = client['Tax Registration Number'] || client['TRN Number'] || client['TRN'] || '';
                const vatVal = client['VAT Treatment'] || client['VAT'] || client['Vat Treatment'] || '';
                const placeVal = client['Place Of Supply'] || client['Place of supply'] || client['Emirate'] || '';
                const trnEl = document.getElementById('invoicePreview_trn'); if (trnEl) trnEl.value = trnVal;
                const vatEl = document.getElementById('invoicePreview_vatTreatment'); if (vatEl) vatEl.value = vatVal;
                const placeEl = document.getElementById('invoicePreview_placeOfSupply'); if (placeEl) placeEl.value = placeVal;
                const nameEl = document.getElementById('invoicePreview_customerName'); if (nameEl) nameEl.value = client['Display Name'] || client['Client Name'] || '';
              }
            });
            // Populate invoice status dropdown in preview by cloning main one
            try {
              const mainStatus = document.getElementById('invoiceStatusDropdown');
              const previewStatus = document.getElementById('invoicePreview_invoiceStatus');
              if (mainStatus && previewStatus) {
                previewStatus.innerHTML = '';
                Array.from(mainStatus.options).forEach(o => previewStatus.appendChild(o.cloneNode(true)));
                // set current selection
                const cur = String(meta.invoiceStatus || '').trim();
                if (cur) {
                  const si = Array.from(previewStatus.options).findIndex(o => String(o.textContent || o.value).trim() === cur || String(o.value).trim() === cur);
                  if (si !== -1) previewStatus.selectedIndex = si;
                }
                previewStatus.addEventListener('change', () => {
                  try { mainStatus.value = previewStatus.value; mainStatus.dispatchEvent(new Event('change',{bubbles:true})); } catch(e) {}
                });

                // Also populate Place Of Supply dropdown (clone options from main emirateDropdown)
                try {
                  const mainPlace = document.getElementById('emirateDropdown');
                  const previewPlace = document.getElementById('invoicePreview_placeOfSupply');
                  if (mainPlace && previewPlace) {
                    previewPlace.innerHTML = '';
                    Array.from(mainPlace.options).forEach(o => previewPlace.appendChild(o.cloneNode(true)));

                    // Normalize common codes (e.g. DU -> Dubai) then try several heuristics to pick the right option
                    function normalizePlaceName(s) {
                      const raw = String(s || '').trim(); if (!raw) return '';
                      const up = raw.toUpperCase();
                      const map = { 'DU': 'Dubai', 'AD': 'Abu Dhabi', 'AB': 'Abu Dhabi', 'AJ': 'Ajman', 'SH': 'Sharjah', 'RAK': 'Ras Al Khaimah', 'RK': 'Ras Al Khaimah', 'FU': 'Fujairah', 'UM': 'Umm Al Quwain', 'FK': 'Fujairah' };
                      if (Object.prototype.hasOwnProperty.call(map, up)) return map[up];
                      return raw;
                    }

                    let curPlaceRaw = String(metaPlace || '').trim();
                    let curPlace = normalizePlaceName(curPlaceRaw);
                    if (curPlace) {
                      const opts = Array.from(previewPlace.options);
                      let spi = opts.findIndex(o => String((o.value||'')).trim().toLowerCase() === curPlace.toLowerCase() || String((o.textContent||o.value||'')).trim().toLowerCase() === curPlace.toLowerCase());
                      // Try a relaxed match: option text includes the curPlace (useful for partials)
                      if (spi === -1) spi = opts.findIndex(o => (o.textContent || '').toLowerCase().includes(curPlace.toLowerCase()) || (o.value || '').toLowerCase().includes(curPlace.toLowerCase()));
                      // If still not found and curPlaceRaw was a 2-letter code try mapping by code key
                      if (spi === -1 && curPlaceRaw && curPlaceRaw.length <= 3) {
                        const mapped = normalizePlaceName(curPlaceRaw.toUpperCase());
                        if (mapped && mapped !== curPlaceRaw) {
                          spi = opts.findIndex(o => String((o.value||'')).trim().toLowerCase() === mapped.toLowerCase() || (o.textContent || '').toLowerCase().includes(mapped.toLowerCase()));
                        }
                      }
                      if (spi !== -1) previewPlace.selectedIndex = spi;
                      else console.warn('invoicePreview: failed to auto-select Place Of Supply for', curPlaceRaw, 'normalized->', curPlace);
                    }

                    previewPlace.addEventListener('change', () => {
                      try { mainPlace.value = previewPlace.value; mainPlace.dispatchEvent(new Event('change',{bubbles:true})); } catch(e) {}
                    });
                  }
                } catch(e) { /* noop */ }
              }
            } catch(e) { /* noop */ }
          }
        } catch (e) { console.warn('populate preview client dropdown failed', e); }

        // Ensure bottom terms textarea reflects the invoice's terms text
        try {
          const bottomTermsEl = document.getElementById('invoicePreview_termsBottom');
          if (bottomTermsEl) bottomTermsEl.value = meta.terms || '';
        } catch (e) { /* noop */ }
      }

      // Populate items
      const tbod = document.getElementById('invoicePreviewItemsBody');
      const grandEl = document.getElementById('invoicePreviewGrandTotal');
      if (tbod) {
        tbod.innerHTML = '';
        itemsToRender.forEach((it, idx) => {
          const tr = document.createElement('tr');
          // Match invoice body columns with editable inputs: #, Description, Qty, Rate, Discount, Taxable Amount, Tax Amount, Tax %, Total, Actions
          tr.innerHTML = `
            <td>${idx + 1}</td>
            <td><textarea class="preview-desc" data-idx="${idx}" style="width:100%" rows="2">${escapeHtml(it.itemDesc || it.itemName)}</textarea></td>
            <td><input class="preview-qty" data-idx="${idx}" type="number" min="0" step="any" value="${escapeHtml(sanitizeNumericForInput(it.qty || '1'))}"></td>
            <td><input class="preview-rate" data-idx="${idx}" type="number" min="0" step="any" value="${escapeHtml(sanitizeNumericForInput(it.itemPrice || ''))}"></td>
            <td><input class="preview-discount" data-idx="${idx}" type="number" min="0" step="any" value="${escapeHtml(sanitizeNumericForInput(it.discount || ''))}"></td>
            <td><input class="preview-taxable" data-idx="${idx}" type="number" min="0" step="any" value="${escapeHtml(sanitizeNumericForInput(it.itemTotal || ''))}"></td>
            <td><input class="preview-taxamount" data-idx="${idx}" type="number" min="0" step="any" value="${escapeHtml(sanitizeNumericForInput(it.itemTaxAmount || ''))}"></td>
            <td>
              <select class="preview-taxpercent" data-idx="${idx}" style="width:60px">
                <option value="5"${String(it.itemTaxPercent || '') == '5' ? ' selected' : ''}>5</option>
                <option value="0"${String(it.itemTaxPercent || '') == '0' ? ' selected' : ''}>0</option>
                <option value="-"${String(it.itemTaxPercent || '') == '-' ? ' selected' : ''}>-</option>
              </select>
            </td>
            <td><input class="preview-total" data-idx="${idx}" type="number" min="0" step="any" value="${escapeHtml(sanitizeNumericForInput(it.itemTotal || ''))}" readonly></td>
            <td style="text-align:center"><button type="button" class="remove-btn" data-idx="${idx}">&times;</button></td>
          `;
          tbod.appendChild(tr);
        });

        // attach handlers to recalc rows and grand total
        attachRowHandlers();
        if (grandEl) grandEl.textContent = Number(itemsToRender.reduce((acc,it)=> acc + (parseFloat(it.itemTotal)||0),0)).toFixed(2);
      }

      // Update nav index
      const uniq = Array.isArray(window.uniqueInvoiceNumbers) ? window.uniqueInvoiceNumbers : (Array.from(new Set((window.allInvoices||[]).map(r=>String(r['Invoice Number']||r['invoice number']||'')))) || []);
      const pos = uniq.indexOf(String(invNum)) !== -1 ? uniq.indexOf(String(invNum)) : -1;
      if (navIndexEl) navIndexEl.textContent = (pos !== -1) ? `${pos+1} / ${uniq.length}` : `1 / ${uniq.length || 1}`;
      // store for prev/next
      overlay._previewIndex = pos;
      overlay._previewList = uniq;
    }

    // Navigation handlers
    prevBtn.onclick = () => {
      const list = overlay._previewList || [];
      let i = overlay._previewIndex || 0;
      if (i > 0) { i--; overlay._previewIndex = i; renderPreview(list[i]); }
    };
    nextBtn.onclick = () => {
      const list = overlay._previewList || [];
      let i = overlay._previewIndex || 0;
      if (i < list.length - 1) { i++; overlay._previewIndex = i; renderPreview(list[i]); }
    };

    // Row/value helpers
    function parseNum(v) { const n = Number(String(v||'').replace(/,/g,'')); return isNaN(n) ? 0 : n; }
    function attachRowHandlers() {
      const rows = Array.from(document.querySelectorAll('#invoicePreviewItemsBody tr'));
      rows.forEach((r, idx) => {
        const qty = r.querySelector('.preview-qty');
        const rate = r.querySelector('.preview-rate');
        const disc = r.querySelector('.preview-discount');
        const taxable = r.querySelector('.preview-taxable');
        const taxamt = r.querySelector('.preview-taxamount');
        const taxPctSel = r.querySelector('.preview-taxpercent');
        const tot = r.querySelector('.preview-total');
        const recalc = () => {
          const q = parseNum(qty ? qty.value : 0);
          const p = parseNum(rate ? rate.value : 0);
          const d = parseNum(disc ? disc.value : 0);
          const base = Math.max(0, q * p - d);
          if (taxable) taxable.value = Number(base).toFixed(2);
          // Compute tax amount from Tax % when a percent is selected; otherwise use editable tax amount
          let ta = 0;
          if (taxPctSel && taxPctSel.value && taxPctSel.value !== '-') {
            const pct = parseFloat(taxPctSel.value) || 0;
            ta = Number(base * (pct / 100));
            if (taxamt) taxamt.value = Number(ta).toFixed(2);
          } else {
            ta = parseNum(taxamt ? taxamt.value : 0);
          }
          const total = base + ta;
          if (tot) tot.value = Number(total).toFixed(2);
          // update grand total
          const grandEl = document.getElementById('invoicePreviewGrandTotal');
          if (grandEl) {
            const sum = Array.from(document.querySelectorAll('.preview-total')).reduce((acc, el) => acc + parseNum(el.value), 0);
            grandEl.textContent = Number(sum).toFixed(2);
            const totalMeta = document.getElementById('invoicePreview_total'); if (totalMeta) totalMeta.textContent = Number(sum).toFixed(2);
          }
        };
        [qty, rate, disc, taxable, taxamt].forEach(el => { if (!el) return; el.addEventListener('input', recalc); });
        if (taxPctSel) taxPctSel.addEventListener('change', recalc);
        // remove handler
        const removeBtn = r.querySelector('.remove-btn');
        if (removeBtn) removeBtn.onclick = () => { r.remove(); attachRowHandlers(); recalc(); };
      });
    }

    function addPreviewRow(data) {
      const tbod = document.getElementById('invoicePreviewItemsBody');
      const idx = (tbod.querySelectorAll('tr').length) ;
      const it = data || { itemDesc: '', qty: '1', itemPrice: '', discount: '', itemTotal: '', itemTaxAmount: '', itemTaxPercent: '' };
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td><textarea class="preview-desc" data-idx="${idx}" style="width:100%" rows="2">${escapeHtml(it.itemDesc || '')}</textarea></td>
        <td><input class="preview-qty" data-idx="${idx}" type="number" min="0" step="any" value="${escapeHtml(sanitizeNumericForInput(it.qty || '1'))}"></td>
        <td><input class="preview-rate" data-idx="${idx}" type="number" min="0" step="any" value="${escapeHtml(sanitizeNumericForInput(it.itemPrice || ''))}"></td>
        <td><input class="preview-discount" data-idx="${idx}" type="number" min="0" step="any" value="${escapeHtml(sanitizeNumericForInput(it.discount || ''))}"></td>
        <td><input class="preview-taxable" data-idx="${idx}" type="number" min="0" step="any" value="${escapeHtml(sanitizeNumericForInput(it.itemTotal || ''))}"></td>
        <td><input class="preview-taxamount" data-idx="${idx}" type="number" min="0" step="any" value="${escapeHtml(sanitizeNumericForInput(it.itemTaxAmount || ''))}"></td>
        <td>
          <select class="preview-taxpercent" data-idx="${idx}" style="width:60px">
            <option value="5"${String(it.itemTaxPercent || '') == '5' ? ' selected' : ''}>5</option>
            <option value="0"${String(it.itemTaxPercent || '') == '0' ? ' selected' : ''}>0</option>
            <option value="-"${String(it.itemTaxPercent || '') == '-' ? ' selected' : ''}>-</option>
          </select>
        </td>
        <td><input class="preview-total" data-idx="${idx}" type="number" min="0" step="any" value="${escapeHtml(sanitizeNumericForInput(it.itemTotal || ''))}" readonly></td>
        <td style="text-align:center"><button type="button" class="remove-btn" data-idx="${idx}">&times;</button></td>
      `;
      tbod.appendChild(tr);
      attachRowHandlers();
      // focus on description
      const desc = tr.querySelector('.preview-desc'); if (desc) setTimeout(()=>desc.focus(),50);
      return tr;
    }

    function applyModalEditsToDOM() {
      // Copy meta fields back to main DOM
      try {
        const md = (id) => document.getElementById(id);
         // If modal has selected client, make the main clientDropdown select that client and call selectClient
         const previewClient = md('invoicePreview_clientDropdown');
         if (previewClient && previewClient.value !== '' && document.getElementById('clientDropdown')) {
           try { document.getElementById('clientDropdown').value = previewClient.value; if (typeof window.selectClient === 'function') window.selectClient(); } catch(e) { console.warn('applyModalEditsToDOM: set main client failed', e); }
         } else {
           const dName = md('invoicePreview_customerName'); if (dName && document.getElementById('clientNameDisplay')) document.getElementById('clientNameDisplay').textContent = dName.value;
         }
        const dVat = md('invoicePreview_vatTreatment'); if (dVat && document.getElementById('vatTreatmentDropdown')) document.getElementById('vatTreatmentDropdown').value = dVat.value;
        const dPlace = md('invoicePreview_placeOfSupply'); if (dPlace && document.getElementById('emirateDropdown')) document.getElementById('emirateDropdown').value = dPlace.value;
        const dTrn = md('invoicePreview_trn'); if (dTrn && document.getElementById('clientTRNDisplay')) document.getElementById('clientTRNDisplay').textContent = dTrn.value;
          const dInclusive = md('invoicePreview_isInclusiveTax'); if (dInclusive) {
            try {
              const v = String(dInclusive.value || 'False');
              const mainIncl = document.getElementById('isInclusiveTax');
              if (mainIncl) {
                if (mainIncl.type === 'checkbox') mainIncl.checked = (v.toLowerCase() === 'true');
                else mainIncl.value = v;
              }
            } catch(e) { console.warn('applyModalEditsToDOM: set inclusive tax failed', e); }
          }
        // Ensure Payment Terms entered in preview are copied back to the main form's terms field
        try {
          const previewPayment = md('invoicePreview_paymentTerms');
          const previewTerms = md('invoicePreview_termsBottom');
          if (previewPayment && document.getElementById('terms')) {
            document.getElementById('terms').value = previewPayment.value;
          } else if (previewTerms && document.getElementById('terms')) {
            // fallback for environments without a Payment Terms input
            document.getElementById('terms').value = previewTerms.value;
          }
        } catch (e) { /* noop */ }
        // Ensure Billing defaults are present when modal edits are applied
        try {
          const billingState = 'Dubai';
          const defaultBillingCountry = 'United Arab Emirates';
          const previewClientEl = md('invoicePreview_clientDropdown');
          const countryEl = document.getElementById('clientCountryDisplay');
          // If a client was selected in the preview, prefer that client's country
          if (previewClientEl && previewClientEl.value && window.clientsData && window.clientsData[previewClientEl.value]) {
            const client = window.clientsData[previewClientEl.value];
            const clientCountry = client['Billing Country'] || client['Country'] || defaultBillingCountry;
            if (countryEl) { countryEl.textContent = clientCountry; countryEl.style.display = clientCountry ? 'block' : 'none'; countryEl.dataset.billingState = billingState; }
          } else if (countryEl && (!countryEl.textContent || String(countryEl.textContent).trim() === '')) {
            countryEl.textContent = defaultBillingCountry;
            countryEl.style.display = 'block';
            countryEl.dataset.billingState = billingState;
          }
        } catch (e) { /* noop */ }
        const dStatus = md('invoicePreview_invoiceStatus'); if (dStatus && document.getElementById('invoiceStatusDropdown')) { try { document.getElementById('invoiceStatusDropdown').value = dStatus.value; document.getElementById('invoiceStatusDropdown').dispatchEvent(new Event('change',{bubbles:true})); } catch(e) {} }
      } catch(e) { console.warn('applyModalEditsToDOM: meta copy failed', e); }

      // Copy items back to DOM rows; ensure sufficient rows exist
      const domTbody = document.getElementById('itemsTable');
      const modalRows = Array.from(document.querySelectorAll('#invoicePreviewItemsBody tr'));
      for (let i=0;i<modalRows.length;i++) {
        const m = modalRows[i];
        const desc = m.querySelector('.preview-desc') ? m.querySelector('.preview-desc').value : '';
        const qty = m.querySelector('.preview-qty') ? m.querySelector('.preview-qty').value : '';
        const rate = m.querySelector('.preview-rate') ? m.querySelector('.preview-rate').value : '';
        const discount = m.querySelector('.preview-discount') ? m.querySelector('.preview-discount').value : '';
        const taxable = m.querySelector('.preview-taxable') ? m.querySelector('.preview-taxable').value : '';
        // ensure DOM row exists
        let dr = domTbody.querySelectorAll('tr')[i];
        if (!dr) {
          if (typeof window.addRow === 'function') {
            try { window.addRow(); } catch(e) {}
            dr = domTbody.querySelectorAll('tr')[i];
          }
        }
        if (!dr) continue;
        // set values on DOM inputs if present
        const descEl = dr.querySelector('.desc-input') || dr.querySelector('.description-input') || dr.querySelector('td:nth-child(2) input'); if (descEl) descEl.value = desc;
        const qtyEl = dr.querySelector('.qty-input') || dr.querySelector('input.qty'); if (qtyEl) qtyEl.value = sanitizeNumericForInput(qty);
        const rateEl = dr.querySelector('.rate-input') || dr.querySelector('.item-rate-input') || dr.querySelector('input.rate'); if (rateEl) rateEl.value = sanitizeNumericForInput(rate);
        const discEl = dr.querySelector('.discount-input') || dr.querySelector('input.discount'); if (discEl) discEl.value = sanitizeNumericForInput(discount);
        // copy taxable/tax percent/tax amount back to main DOM
        const taxableEl = dr.querySelector('.taxable-amount') || dr.querySelector('input.taxable-amount'); if (taxableEl) { if (taxableEl.tagName === 'INPUT') taxableEl.value = sanitizeNumericForInput(taxable); else taxableEl.textContent = sanitizeNumericForInput(taxable); }
        const previewTaxPercent = m.querySelector('.preview-taxpercent') ? m.querySelector('.preview-taxpercent').value : '';
        const taxPctEl = dr.querySelector('.tax-percent-input') || dr.querySelector('select.tax-percent-input'); if (taxPctEl && typeof previewTaxPercent !== 'undefined') { try { taxPctEl.value = previewTaxPercent; taxPctEl.dispatchEvent(new Event('change',{bubbles:true})); } catch (e) { taxPctEl.value = previewTaxPercent; } }
        const previewTaxAmt = m.querySelector('.preview-taxamount') ? (m.querySelector('.preview-taxamount').value || m.querySelector('.preview-taxamount').textContent || '') : '';
        const taxAmtEl = dr.querySelector('.tax-amount') || dr.querySelector('input.tax-amount'); if (taxAmtEl) { if (taxAmtEl.tagName === 'INPUT') taxAmtEl.value = sanitizeNumericForInput(previewTaxAmt); else taxAmtEl.textContent = sanitizeNumericForInput(previewTaxAmt); }
        // Trigger any change listeners
        [descEl, qtyEl, rateEl, discEl].forEach(el => { if (el) el.dispatchEvent(new Event('input',{bubbles:true})); });
      }
      // If modal has fewer rows than the main DOM, remove the extra DOM rows so updates delete them on sheet
      try {
        const domRows = domTbody ? Array.from(domTbody.querySelectorAll('tr')) : [];
        if (domRows.length > modalRows.length) {
          for (let j = domRows.length - 1; j >= modalRows.length; j--) {
            const r = domRows[j]; if (r) r.remove();
          }
          // Recalculate totals after removing rows
          if (typeof window.calculateTotals === 'function') window.calculateTotals();
          console.log('applyModalEditsToDOM: removed', domRows.length - modalRows.length, 'extra DOM rows');
        }
      } catch (e) { console.warn('applyModalEditsToDOM: failed to remove extra DOM rows', e); }
    }

    // initial render
    renderPreview(invoiceNumber);



    // Add item button handler
    const addItemBtn = document.getElementById('invoicePreview_addItem');
    if (addItemBtn) addItemBtn.onclick = () => { addPreviewRow(); };

    // Save button wiring - applies modal edits to DOM then updates Google Sheet using existing update flow
    const saveBtn = document.getElementById('invoicePreview_saveBtn');
    if (saveBtn) {
      saveBtn.onclick = async () => {
        try {
          if (!confirm('Save changes to Google Sheets for this invoice?')) return;
          saveBtn.disabled = true; saveBtn.textContent = 'Saving...';
          applyModalEditsToDOM();
          const inv = invoiceNumber;
          if (!inv) { alert('No invoice selected'); return; }
          if (typeof window.updateInvoiceOnSheet === 'function') {
            const ok = await window.updateInvoiceOnSheet(inv);
            if (ok) { if (typeof window.showToast === 'function') window.showToast('Save completed', 'success'); else alert('Save completed'); } else { if (typeof window.showToast === 'function') window.showToast('Save finished with warnings (see console)', 'warning'); else alert('Save finished with warnings (see console)'); }
          } else {
            alert('Update function not available in this environment');
          }
        } catch (err) { alert('Save failed: ' + (err && err.message ? err.message : err)); console.error(err); }
        finally { saveBtn.disabled = false; saveBtn.textContent = 'Save to Sheet'; }
      };
    }

    // confirm handler: apply edits and update if allowed
    if (allowUpdate) {
      const confirmBtn = document.getElementById('confirmInvoicePreviewUpdate');
      if (confirmBtn) confirmBtn.onclick = async () => {
        try { applyModalEditsToDOM(); } catch(e){ console.warn('Failed to apply modal edits', e); }
        closeInvoicePreviewModal();
        if (typeof window.updateInvoiceOnSheet === 'function') {
          try { await window.updateInvoiceOnSheet(invoiceNumber); } catch(e){ alert('Update failed: ' + (e && e.message ? e.message : e)); }
        } else alert('Update function not available');
      };
    }

    // Helper escape
    function escapeHtml(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  }

  function closeInvoicePreviewModal() { const o = document.querySelector('#bundlesModalOverlay[data-preview="invoice"]'); if (o) { o.remove(); document.body.style.overflow = ''; } }

  window.openInvoicePreviewModal = openInvoicePreviewModal;
  // Open preview without update permission
  window.previewCurrentInvoice = function(){ const inv = document.getElementById('invoiceNumber') ? (document.getElementById('invoiceNumber').value || '').trim() : ''; if (!inv) { alert('No invoice selected'); return; } openInvoicePreviewModal(inv, { allowUpdate: false }); };
  // Open preview with update permission (explicit)
  window.openInvoicePreviewForUpdate = function(invoiceNumber){ const inv = invoiceNumber || (document.getElementById('invoiceNumber') ? (document.getElementById('invoiceNumber').value || '').trim() : ''); if (!inv) { alert('No invoice selected'); return; } openInvoicePreviewModal(inv, { allowUpdate: true }); };

  console.log('invoice-preview loaded');
})();
