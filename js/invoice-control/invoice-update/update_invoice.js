 (function(){
    'use strict';

    // Helper: convert 0-based column index to A1 letter(s)
    function colToA1(n) {
        if (window.updateHelpers && typeof window.updateHelpers.colToA1 === 'function') return window.updateHelpers.colToA1(n);
        let s = '';
        while (n >= 0) {
            s = String.fromCharCode((n % 26) + 65) + s;
            n = Math.floor(n / 26) - 1;
        }
        return s;
    }

    async function updateInvoiceOnSheet(invoiceNumber) {
        if (!invoiceNumber) { console.warn('updateInvoiceOnSheet: invoiceNumber required'); return false; }
        if (!window.ServiceAccountAuth || typeof window.ServiceAccountAuth.fetch !== 'function') { console.warn('ServiceAccountAuth not available'); return false; }

        const SPREADSHEET_ID = window.GOOGLE_SPREADSHEET_ID || '17gh8MZSeFVPQudyTGwYf5_pFWH8yt-xpCPiPy9i8x-U';
        const SHEET_NAME = 'Invoices';

        // Read sheet
        const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_NAME}!A:Z`;
        const resp = await window.ServiceAccountAuth.fetch(readUrl);
        const sheetData = await resp.json();
        if (!sheetData || !sheetData.values || sheetData.values.length === 0) { console.error('Failed to read sheet'); return false; }

        const header = sheetData.values[0].map(h => (String(h||'').trim()));
        const headerLower = header.map(h=>String(h).trim().toLowerCase());

        // Helper: find header index using Columns Index mapping first, then fuzzy match on header names
        function getHeaderIndex(candidates) {
            if (!Array.isArray(candidates)) candidates = [candidates];
            // Try columns index map
            const fromMap = findInIndexMap(candidates);
            if (fromMap !== -1) return fromMap;
            // Fuzzy scan headerLower
            const lowerCandidates = candidates.map(s => String(s||'').toLowerCase());
            for (let i=0;i<headerLower.length;i++) {
                const h = headerLower[i];
                if (lowerCandidates.some(c => h === c || h.includes(c) || c.includes(h))) return i;
            }
            return -1;
        }

        // Try to obtain a columns index mapping (preferred) from columns_index_loader
        let indexMap = null;
        if (typeof window.loadColumnsIndexFromSheet === 'function') {
            try { indexMap = await window.loadColumnsIndexFromSheet('Invoices', { force: false }); } catch (e) { indexMap = (typeof window.getColumnsIndexCached === 'function') ? window.getColumnsIndexCached('Invoices') : null; }
        } else if (typeof window.getColumnsIndexCached === 'function') {
            indexMap = window.getColumnsIndexCached('Invoices') || null;
        }

        function findInIndexMap(candidates) {
            if (window.updateHelpers && typeof window.updateHelpers.findInIndexMap === 'function') return window.updateHelpers.findInIndexMap(candidates, indexMap);
            if (!indexMap) return -1;
            const keys = Object.keys(indexMap || {});
            // try exact candidate keys first
            for (const c of candidates) {
                if (Object.prototype.hasOwnProperty.call(indexMap, c) && Number.isFinite(indexMap[c])) return indexMap[c];
            }
            // try fuzzy contains match
            const lowerCandidates = candidates.map(s => s.toLowerCase());
            for (const k of keys) {
                const kl = String(k || '').toLowerCase();
                if (lowerCandidates.some(c => kl === c || kl.includes(c) || c.includes(kl))) {
                    const v = indexMap[k]; if (Number.isFinite(v)) return v;
                }
            }
            return -1;
        }

        // Determine invoice and status columns (prefer indexMap, fall back to header scan)
        let invCol = findInIndexMap(['Invoice Number','Invoice#','Invoice']);
        let statusCol = findInIndexMap(['Invoice Status','Status']);
        if (invCol === -1) {
            // fallback: header scan
            const find = (names) => {
                const lowerNames = (Array.isArray(names) ? names : [names]).map(s => s.toLowerCase());
                for (let i=0;i<headerLower.length;i++) {
                    const h = headerLower[i];
                    if (lowerNames.some(n => h === n || h.includes(n))) return i;
                }
                return -1;
            };
            invCol = find(['invoice number','invoice#','invoice']);
        }
        if (statusCol === -1) statusCol = (function(){
            const find = (names) => {
                const lowerNames = (Array.isArray(names) ? names : [names]).map(s => s.toLowerCase());
                for (let i=0;i<headerLower.length;i++) {
                    const h = headerLower[i];
                    if (lowerNames.some(n => h === n || h.includes(n))) return i;
                }
                return -1;
            };
            return find(['invoice status','status']);
        })();

        if (invCol === -1) { console.error('Invoice Number column not found'); return false; }
        if (statusCol === -1) { console.error('Invoice Status column not found'); return false; }

        const rows = sheetData.values;
        const matchingRowNums = [];
        for (let i=1;i<rows.length;i++) {
            const row = rows[i];
            const val = String(row[invCol]||'').trim();
            if (val === String(invoiceNumber).trim()) matchingRowNums.push(i+1); // 1-based
        }

        if (matchingRowNums.length === 0) { console.warn('No rows found for invoice', invoiceNumber); return false; }

        // Check original status from first matched row
        const firstRow = rows[matchingRowNums[0]-1];
        const origStatus = String(firstRow[statusCol]||'').trim();
        if (origStatus.toLowerCase() !== 'draft') {
            alert('Invoice is not in Draft status — updates are only allowed for Draft invoices.');
            return false;
        }

        // Build updated item objects from page DOM (same shape as save flow)
        const tbody = document.getElementById('itemsTable');
        const domRows = tbody ? Array.from(tbody.querySelectorAll('tr')) : [];
        const updatedItems = [];
        domRows.forEach(row => {
            const desc = row.querySelector('.desc-input') ? row.querySelector('.desc-input').value.trim() : '';
            const qty = row.querySelector('.qty-input') ? row.querySelector('.qty-input').value.trim() : '';
            const rate = row.querySelector('.rate-input') ? row.querySelector('.rate-input').value.trim() : '';
            const discount = row.querySelector('.discount-input') ? row.querySelector('.discount-input').value.trim() : '';
            const taxPercent = row.querySelector('.tax-percent-input') ? row.querySelector('.tax-percent-input').value.trim() : '';
            const taxableEl = row.querySelector('.taxable-amount');
            const taxable = taxableEl ? (taxableEl.textContent||'').replace(/,/g,'').trim() : '';
            const taxEl = row.querySelector('.tax-amount');
            const taxAmt = taxEl ? (taxEl.textContent||'').replace(/,/g,'').trim() : '';
            const hasAny = desc || qty || rate || taxPercent;
            if (!hasAny) return;
            // Normalize numeric values and compute item total similar to save flow
            const qtyNum = parseFloat(qty) || 0;
            const rateNum = parseFloat(rate) || 0;
            const discountNum = parseFloat(discount) || 0;
            const itemTotalNum = Math.max(0, qtyNum * rateNum - discountNum);
            const taxableNum = (taxable && String(taxable).trim() !== '') ? parseFloat(taxable) || 0 : itemTotalNum;
            const taxAmtNum = (taxAmt && String(taxAmt).trim() !== '') ? parseFloat(taxAmt) || 0 : ((parseFloat(taxPercent) || 0) > 0 ? (taxableNum * (parseFloat(taxPercent) / 100)) : 0);

            updatedItems.push({
                'Item Desc': desc,
                'Quantity': qtyNum ? String(qtyNum) : '1',
                'Item Price': rateNum ? String(rateNum) : '',
                'Discount': discountNum ? String(discountNum) : '0',
                'Item Total': itemTotalNum ? itemTotalNum.toFixed(2) : '',
                'Taxable Amount': taxableNum ? taxableNum.toFixed(2) : '',
                'Item Tax %': taxPercent,
                'Item Tax Amount': taxAmtNum ? taxAmtNum.toFixed(2) : ''
            });
        });

        if (updatedItems.length === 0) { alert('No items to update'); return false; }

        // Compute invoice-level totals from updated items and read current status from UI
        let invoiceSubtotal = 0;
        let invoiceTaxTotal = 0;
        updatedItems.forEach(it => {
            invoiceSubtotal += parseFloat(it['Taxable Amount'] || it['Item Total'] || 0) || 0;
            invoiceTaxTotal += parseFloat(it['Item Tax Amount'] || 0) || 0;
        });
        const invoiceTotal = invoiceSubtotal + invoiceTaxTotal;
        const currentStatus = (document.getElementById('invoiceStatusDropdown') && (document.getElementById('invoiceStatusDropdown').value || '').trim()) || 'Draft';

        // Defaults to ensure updated rows contain these invoice-level values when missing
        const invoiceUpdateDefaults = {
            'Is Inclusive Tax': 'FALSE',
            'Currency Code': 'AED',
            'Exchange Rate': '1',
            'Discount Type': 'item_level',
            'Is Discount Before Tax': 'TRUE',
            'Entity Discount Percent': '0',
            'Billing State': 'Dubai',
            'Billing Country': 'United Arab Emirates',
            'Account': 'Sales'
        };

        // Helper to map an object to full row array using header
        function mapObjToRow(obj /* always set totals on each row */) {
            const out = new Array(header.length).fill('');
            Object.keys(obj||{}).forEach(k => {
                const idx = headerLower.indexOf(String(k).toLowerCase());
                if (idx !== -1) out[idx] = obj[k] !== undefined && obj[k] !== null ? String(obj[k]) : '';
            });
            // Ensure invoice-level columns are set
            const invoiceDate = document.getElementById('invoiceDate') ? document.getElementById('invoiceDate').value : '';
            const dueDate = document.getElementById('dueDate') ? document.getElementById('dueDate').value : '';
            const paymentTerms = document.getElementById('terms') ? document.getElementById('terms').value : '';
            const customerName = document.getElementById('clientNameDisplay') ? document.getElementById('clientNameDisplay').textContent.trim() : '';
            const notes = document.getElementById('notesText') ? document.getElementById('notesText').value : '';
            const vatTreatment = document.getElementById('vatTreatmentDropdown') ? document.getElementById('vatTreatmentDropdown').value : '';
            // Normalize Place Of Supply to two-letter emirate code (first 2 letters, uppercase)
            function getEmirateCode() {
                const el = document.getElementById('emirateDropdown');
                const raw = el && el.value ? String(el.value).trim() : '';
                return raw ? raw.substring(0,2).toUpperCase() : '';
            }
            const emirate = getEmirateCode();

            const fallbacks = {
                'Invoice Date': invoiceDate ? (function(d){ const m=d.match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}/${m[2]}/${m[1]}` : invoiceDate; })(invoiceDate) : '',
                'Due Date': dueDate ? (function(d){ const m=d.match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}/${m[2]}/${m[1]}` : dueDate; })(dueDate) : '',
                // Per requirement: Payment Terms column should be numeric '0',
                // while the human-readable label goes into 'Payment Terms Label'.
                'Payment Terms': '0',
                'Payment Terms Label': paymentTerms || '',
                'Customer Name': customerName || '',
                'Notes': notes || '',
                'VAT Treatment': vatTreatment || '',
                'Place Of Supply': emirate || '',
                'Billing State': 'Dubai',
                'Billing Country': 'United Arab Emirates',
                'Account': 'Sales'
            };
            Object.keys(fallbacks).forEach(k => { const idx = headerLower.indexOf(k.toLowerCase()); if (idx !== -1 && !out[idx]) out[idx] = fallbacks[k]; });
            // Ensure Invoice Number and Invoice Status are set
            const idxInv = invCol; if (idxInv !== -1) out[idxInv] = invoiceNumber;
            const idxStatus = statusCol; if (idxStatus !== -1) out[idxStatus] = currentStatus || 'Draft';

            // Ensure Subtotal and Total are set on each row (per request: repeat totals on all invoice rows)
            const setIfExists = (names, value) => {
                for (const n of (Array.isArray(names) ? names : [names])) {
                    const idx = headerLower.indexOf(String(n).toLowerCase());
                    if (idx !== -1) { out[idx] = (value !== undefined && value !== null) ? String(value) : ''; return; }
                }
            };
            // Always populate totals on each invoice row
            setIfExists(['SubTotal','Subtotal','Sub Total'], (invoiceSubtotal !== undefined ? Number(invoiceSubtotal).toFixed(2) : ''));
            setIfExists(['Total','Invoice Total','Grand Total'], (invoiceTotal !== undefined ? Number(invoiceTotal).toFixed(2) : ''));
            // Apply update-time defaults where columns exist but are empty
            Object.keys(invoiceUpdateDefaults).forEach(k => {
                const idx = getHeaderIndex(k);
                if (idx !== -1 && (!out[idx] || String(out[idx]).trim() === '')) out[idx] = invoiceUpdateDefaults[k];
            });

            // Additional invoice-level fields requested: Item Type, VAT Treatment, Place Of Supply, Tax Registration Number
            const bankText = 'Bank Account Details\nBank Name: Emirates NBD\nIBAN: AE360260001015867786601\nAccount No: 1015867786601';
            const clientTRNRendered = (document.getElementById('clientTRNDisplay') && (document.getElementById('clientTRNDisplay').textContent || '').replace(/^TRN\s*/i,'')) || (document.getElementById('vatNo') ? (document.getElementById('vatNo').value || '') : '');
            const extraFields = [
                { names: ['item type','item_type','itemtype'], value: 'Service' },
                { names: ['vat treatment','vat_treatment','vat'], value: vatTreatment },
                { names: ['place of supply','place_of_supply','supply'], value: emirate },
                { names: ['tax registration number','tax registration no','tax registration','trn'], value: clientTRNRendered },
                { names: ['terms & conditions','bank-row','bank row','bank_row','bankrow'], value: bankText }
            ];
            extraFields.forEach(f => {
                const idx = getHeaderIndex(f.names);
                if (idx !== -1 && (!out[idx] || String(out[idx]).trim() === '')) out[idx] = f.value;
            });
            return out;
        }

        // Prepare arrays
        const mappedRows = updatedItems.map((r, i) => mapObjToRow(r, i === 0));

        // Ensure Place Of Supply column is explicitly set to the two-letter emirate code
        // (some sheets expect this at a fixed column — ensure we populate it regardless)
        const placeIdx = getHeaderIndex(['Place Of Supply','place of supply','place_of_supply','supply']);
        if (placeIdx !== -1) {
            const posVal = (function(){ const el = document.getElementById('emirateDropdown'); const v = el && el.value ? String(el.value).trim() : ''; return v ? v.substring(0,2).toUpperCase() : 'DU'; })();
            for (let i = 0; i < mappedRows.length; i++) {
                mappedRows[i][placeIdx] = posVal;
            }
        }

        // Ensure Payment Terms Label column is set to the label and Payment Terms is '0' on every mapped row
        const ptLabelIdx = getHeaderIndex(['Payment Terms Label','payment terms label','payment terms label']);
        const ptIdx = getHeaderIndex(['Payment Terms','payment terms']);
        if (ptLabelIdx !== -1 || ptIdx !== -1) {
            const labelVal = (document.getElementById('terms') && (document.getElementById('terms').value || '')) || '';
            for (let i = 0; i < mappedRows.length; i++) {
                if (ptLabelIdx !== -1) mappedRows[i][ptLabelIdx] = labelVal;
                if (ptIdx !== -1) mappedRows[i][ptIdx] = '0';
            }
        }

        // Ensure Invoice Type column is set to 'Invoice' on every mapped row (fallback to index 20 if header not found)
        const invoiceTypeIdx = getHeaderIndex(['Invoice Type','invoicetype','invoice']);
        for (let i = 0; i < mappedRows.length; i++) {
            if (invoiceTypeIdx !== -1) mappedRows[i][invoiceTypeIdx] = 'Invoice';
            else mappedRows[i][19] = 'Invoice'; // index 20 (1-based) -> 19 (0-based)
        }

        // Find SubTotal/Total column indexes so we can ensure only the first row has invoice-level totals
        const subtotalCol = (function(){
            const candidates = ['SubTotal','Subtotal','Sub Total'];
            for (const c of candidates) {
                const idx = headerLower.indexOf(String(c).toLowerCase());
                if (idx !== -1) return idx;
            }
            return -1;
        })();
        const totalCol = (function(){
            const candidates = ['Total','Invoice Total','Grand Total'];
            for (const c of candidates) {
                const idx = headerLower.indexOf(String(c).toLowerCase());
                if (idx !== -1) return idx;
            }
            return -1;
        })();

        // Per request: ensure mapped rows include totals (already set), no need to clear them here

        // Detect Item Price / Item Total columns so we explicitly populate them for each mapped row
        const itemPriceCol = (function(){
            const candidates = ['Item Price','ItemPrice','Item Price FCY','Item Price BCY','Item Price '];
            for (const c of candidates) {
                const idx = headerLower.indexOf(String(c).toLowerCase());
                if (idx !== -1) return idx;
            }
            // fallback to indexMap
            const idxFromMap = findInIndexMap(['Item Price','ItemPrice','Item Total','Item Total Amount']);
            return idxFromMap !== -1 ? idxFromMap : -1;
        })();
        const itemTotalCol = (function(){
            const candidates = ['Taxable Amount','TaxableAmount','taxable-amount','Item Total','ItemTotal'];
            for (const c of candidates) {
                const idx = headerLower.indexOf(String(c).toLowerCase());
                if (idx !== -1) return idx;
            }
            const idxFromMap = findInIndexMap(['Item Total','ItemTotal','Total']);
            return idxFromMap !== -1 ? idxFromMap : -1;
        })();

        // Safety: if itemTotalCol resolved to the same as invoice-level total column, disable it
        if (itemTotalCol === totalCol) {
            console.warn('Detected itemTotalCol equals totalCol — disabling itemTotalCol to avoid overwriting grand total');
            // set to -1 to prevent accidental writes
            itemTotalCol = -1;
        }

        // Detect Item Tax Amount column (e.g., 'Item Tax Amount' or 'tax-amount')
        const itemTaxCol = (function(){
            const candidates = ['Item Tax Amount','Item Tax','ItemTaxAmount','ItemTax','tax-amount','Item Tax Amount'];
            for (const c of candidates) {
                const idx = headerLower.indexOf(String(c).toLowerCase());
                if (idx !== -1) return idx;
            }
            const idxFromMap = findInIndexMap(['Item Tax Amount','Item Tax','Tax Amount']);
            return idxFromMap !== -1 ? idxFromMap : -1;
        })();

        // Detect Item Tax Type and Item Tax % columns
        const itemTaxTypeCol = (function(){
            const candidates = ['Item Tax','Item Tax Type','Item Tax Name'];
            for (const c of candidates) {
                const idx = headerLower.indexOf(String(c).toLowerCase());
                if (idx !== -1) return idx;
            }
            const idxFromMap = findInIndexMap(['Item Tax','Item Tax Type']);
            return idxFromMap !== -1 ? idxFromMap : -1;
        })();
        const itemTaxPercentCol = (function(){
            const candidates = ['Item Tax %','Item Tax Percent','Item Tax Percentage','ItemTax%'];
            for (const c of candidates) {
                const idx = headerLower.indexOf(String(c).toLowerCase());
                if (idx !== -1) return idx;
            }
            const idxFromMap = findInIndexMap(['Item Tax %','Item Tax Percent']);
            return idxFromMap !== -1 ? idxFromMap : -1;
        })();

        // Populate item price/total explicitly to ensure they are written for every mapped row
        for (let i = 0; i < mappedRows.length; i++) {
            const src = updatedItems[i] || {};
            if (itemPriceCol !== -1) mappedRows[i][itemPriceCol] = src['Item Price'] !== undefined ? String(src['Item Price']) : '';
            // Per sheet mapping: item total stored in Taxable Amount column in this environment
            if (itemTotalCol !== -1) mappedRows[i][itemTotalCol] = (src['Taxable Amount'] !== undefined ? String(src['Taxable Amount']) : (src['Item Total'] !== undefined ? String(src['Item Total']) : ''));
            if (itemTaxCol !== -1) mappedRows[i][itemTaxCol] = src['Item Tax Amount'] !== undefined ? String(src['Item Tax Amount']) : '';
            if (itemTaxPercentCol !== -1) mappedRows[i][itemTaxPercentCol] = src['Item Tax %'] !== undefined ? String(src['Item Tax %']) : '';

            // Derive Item Tax type string from percent using shared util (keeps logic consistent)
            try {
                const rawPct = (src['Item Tax %'] !== undefined && src['Item Tax %'] !== null) ? String(src['Item Tax %']).trim() : '';
                const derived = (window.taxUtils && typeof window.taxUtils.deriveTaxTypeFromPercent === 'function') ? window.taxUtils.deriveTaxTypeFromPercent(rawPct) : (function(r){ if (r === '-' || r === '') return { taxType: 'exempt', pctValue: '' }; const pct = parseFloat(String(r).replace('%','')) || 0; if (Math.abs(pct - 5) < 0.0001) return { taxType: 'standard rate', pctValue: '5' }; if (Math.abs(pct - 0) < 0.0001) return { taxType: 'zero rate', pctValue: '0' }; return { taxType: 'exempt', pctValue: '' }; })(rawPct);
                if (itemTaxTypeCol !== -1) mappedRows[i][itemTaxTypeCol] = derived.taxType;
                if (itemTaxPercentCol !== -1) mappedRows[i][itemTaxPercentCol] = derived.pctValue;
            } catch (e) { /* noop */ }
        }

        // Update existing rows (replace up to min length)
        const minLen = Math.min(matchingRowNums.length, mappedRows.length);
        for (let i=0;i<minLen;i++) {
            const rowNum = matchingRowNums[i];
            const arr = mappedRows[i];
            const lastColLetter = colToA1(arr.length-1);
            const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_NAME}!A${rowNum}:${lastColLetter}${rowNum}?valueInputOption=USER_ENTERED`;
            await window.ServiceAccountAuth.fetch(updateUrl, { method: 'PUT', body: JSON.stringify({ values: [arr] }) });
            console.log('Updated row', rowNum);
        }

        // If there are more updated items, append them
        if (mappedRows.length > matchingRowNums.length) {
            const toAppend = mappedRows.slice(matchingRowNums.length);
            const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_NAME}!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
            await window.ServiceAccountAuth.fetch(appendUrl, { method: 'POST', body: JSON.stringify({ values: toAppend }) });
            console.log('Appended', toAppend.length, 'rows');
        }

        // If there are more existing rows than updated items, delete the extra rows from the sheet (preferred)
        if (matchingRowNums.length > mappedRows.length) {
            const extraRows = matchingRowNums.slice(mappedRows.length);
            // Group contiguous ranges for deletion
            const ranges = [];
            let start = extraRows[0], end = extraRows[0];
            for (let k = 1; k < extraRows.length; k++) {
                const r = extraRows[k];
                if (r === end + 1) end = r; else { ranges.push({ start, end }); start = r; end = r; }
            }
            ranges.push({ start, end });

            // Try to obtain sheetId for the named sheet
            let sheetId = null;
            try {
                const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties`;
                const metaResp = await window.ServiceAccountAuth.fetch(metaUrl);
                const meta = await metaResp.json();
                if (meta && Array.isArray(meta.sheets)) {
                    for (const s of meta.sheets) {
                        if (s && s.properties && s.properties.title === SHEET_NAME) { sheetId = s.properties.sheetId; break; }
                    }
                }
            } catch (e) { console.warn('Failed to load spreadsheet metadata for delete operation', e); }

            if (Number.isFinite(sheetId)) {
                const requests = ranges.map(r => ({ deleteDimension: { range: { sheetId: sheetId, dimension: 'ROWS', startIndex: r.start - 1, endIndex: r.end } } }));
                try {
                    const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`;
                    await window.ServiceAccountAuth.fetch(batchUrl, { method: 'POST', body: JSON.stringify({ requests }) });
                    console.log('Deleted sheet rows for invoice', invoiceNumber, ranges);
                } catch (e) {
                    console.warn('Row deletion via batchUpdate failed, falling back to clearing rows', e);
                    // fallback to clearing rows one-by-one if deletion fails
                    for (let j = mappedRows.length; j < matchingRowNums.length; j++) {
                        const rowNum = matchingRowNums[j];
                        const clearArr = new Array(header.length).fill('');
                        clearArr[invCol] = invoiceNumber;
                        clearArr[statusCol] = currentStatus || 'Draft';
                        if (subtotalCol !== -1) clearArr[subtotalCol] = (invoiceSubtotal !== undefined ? Number(invoiceSubtotal).toFixed(2) : '');
                        if (totalCol !== -1) clearArr[totalCol] = (invoiceTotal !== undefined ? Number(invoiceTotal).toFixed(2) : '');
                        Object.keys(invoiceUpdateDefaults).forEach(k => { const idx = headerLower.indexOf(String(k).toLowerCase()); if (idx !== -1) clearArr[idx] = invoiceUpdateDefaults[k]; });
                        (function(){
                            const bankIdx = getHeaderIndex(['terms & conditions','bank-row','bank row','bank_row','bankrow']); if (bankIdx !== -1) clearArr[bankIdx] = 'Bank Account Details\nBank Name: Emirates NBD\nIBAN: AE360260001015867786601\nAccount No: 1015867786601';
                            const itemTypeIdx = getHeaderIndex(['item type','item_type','itemtype']); if (itemTypeIdx !== -1) clearArr[itemTypeIdx] = 'Service';
                            const vatIdx = getHeaderIndex(['vat treatment','vat_treatment','vat']); if (vatIdx !== -1) clearArr[vatIdx] = (document.getElementById('vatTreatmentDropdown') && (document.getElementById('vatTreatmentDropdown').value || '')) || '';
                            const posIdx = getHeaderIndex(['place of supply','place_of_supply','supply']); if (posIdx !== -1) clearArr[posIdx] = (function(){ const el = document.getElementById('emirateDropdown'); const v = el && el.value ? String(el.value).trim() : ''; return v ? v.substring(0,2).toUpperCase() : ''; })() || '';
                            const ptLabelIdx = getHeaderIndex(['Payment Terms Label','payment terms label','payment terms label']); if (ptLabelIdx !== -1) clearArr[ptLabelIdx] = (document.getElementById('terms') && (document.getElementById('terms').value || '')) || '';
                            const invTypeIdx = getHeaderIndex(['Invoice Type','invoicetype','invoice']); if (invTypeIdx !== -1) clearArr[invTypeIdx] = 'Invoice'; else clearArr[19] = 'Invoice';
                            const trnDisplay = (document.getElementById('clientTRNDisplay') && (document.getElementById('clientTRNDisplay').textContent || '').replace(/^TRN\s*/i,'')) || (document.getElementById('vatNo') ? (document.getElementById('vatNo').value || '') : '');
                            const trnIdx = getHeaderIndex(['tax registration number','tax registration no','tax registration','trn']); if (trnIdx !== -1) clearArr[trnIdx] = trnDisplay;
                        })();
                        const lastColLetter = colToA1(clearArr.length-1);
                        const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_NAME}!A${rowNum}:${lastColLetter}${rowNum}?valueInputOption=USER_ENTERED`;
                        await window.ServiceAccountAuth.fetch(updateUrl, { method: 'PUT', body: JSON.stringify({ values: [clearArr] }) });
                        console.log('Cleared row (fallback)', rowNum);
                    }
                }
            } else {
                // Could not determine sheetId; fallback to clearing rows
                console.warn('SheetId for', SHEET_NAME, 'not found; clearing rows instead of deleting');
                for (let j = mappedRows.length; j < matchingRowNums.length; j++) {
                    const rowNum = matchingRowNums[j];
                    const clearArr = new Array(header.length).fill('');
                    clearArr[invCol] = invoiceNumber;
                    clearArr[statusCol] = currentStatus || 'Draft';
                    if (subtotalCol !== -1) clearArr[subtotalCol] = (invoiceSubtotal !== undefined ? Number(invoiceSubtotal).toFixed(2) : '');
                    if (totalCol !== -1) clearArr[totalCol] = (invoiceTotal !== undefined ? Number(invoiceTotal).toFixed(2) : '');
                    Object.keys(invoiceUpdateDefaults).forEach(k => { const idx = headerLower.indexOf(String(k).toLowerCase()); if (idx !== -1) clearArr[idx] = invoiceUpdateDefaults[k]; });
                    (function(){
                        const bankIdx = getHeaderIndex(['terms & conditions','bank-row','bank row','bank_row','bankrow']); if (bankIdx !== -1) clearArr[bankIdx] = 'Bank Account Details\nBank Name: Emirates NBD\nIBAN: AE360260001015867786601\nAccount No: 1015867786601';
                        const itemTypeIdx = getHeaderIndex(['item type','item_type','itemtype']); if (itemTypeIdx !== -1) clearArr[itemTypeIdx] = 'Service';
                        const vatIdx = getHeaderIndex(['vat treatment','vat_treatment','vat']); if (vatIdx !== -1) clearArr[vatIdx] = (document.getElementById('vatTreatmentDropdown') && (document.getElementById('vatTreatmentDropdown').value || '')) || '';
                        const posIdx = getHeaderIndex(['place of supply','place_of_supply','supply']); if (posIdx !== -1) clearArr[posIdx] = (function(){ const el = document.getElementById('emirateDropdown'); const v = el && el.value ? String(el.value).trim() : ''; return v ? v.substring(0,2).toUpperCase() : ''; })() || '';
                        const ptLabelIdx = getHeaderIndex(['Payment Terms Label','payment terms label','payment terms label']); if (ptLabelIdx !== -1) clearArr[ptLabelIdx] = (document.getElementById('terms') && (document.getElementById('terms').value || '')) || '';
                        const invTypeIdx = getHeaderIndex(['Invoice Type','invoicetype','invoice']); if (invTypeIdx !== -1) clearArr[invTypeIdx] = 'Invoice'; else clearArr[19] = 'Invoice';
                        const trnDisplay = (document.getElementById('clientTRNDisplay') && (document.getElementById('clientTRNDisplay').textContent || '').replace(/^TRN\s*/i,'')) || (document.getElementById('vatNo') ? (document.getElementById('vatNo').value || '') : '');
                        const trnIdx = getHeaderIndex(['tax registration number','tax registration no','tax registration','trn']); if (trnIdx !== -1) clearArr[trnIdx] = trnDisplay;
                    })();
                    const lastColLetter = colToA1(clearArr.length-1);
                    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_NAME}!A${rowNum}:${lastColLetter}${rowNum}?valueInputOption=USER_ENTERED`;
                    await window.ServiceAccountAuth.fetch(updateUrl, { method: 'PUT', body: JSON.stringify({ values: [clearArr] }) });
                    console.log('Cleared row (no sheetId)', rowNum);
                }
            }
        }

        // Reload data so UI shows updated values and navigate back to the same invoice
        try {
            if (window.dataLoader && typeof window.dataLoader.loadFromGoogleSheets === 'function') {
                const statusEl = document.getElementById('sheetsLoadStatus');
                await window.dataLoader.loadFromGoogleSheets(statusEl);
            }

            // Update unique invoice numbers and navigate to the updated invoice (instead of jumping to last)
            try { if (typeof window.updateUniqueInvoiceNumbers === 'function') window.updateUniqueInvoiceNumbers(); } catch(e) { /* noop */ }
            if (Array.isArray(window.uniqueInvoiceNumbers)) {
                const savedIndex = window.uniqueInvoiceNumbers.indexOf(invoiceNumber);
                if (savedIndex !== -1) {
                    window.currentInvoiceIndex = savedIndex;
                    if (typeof window.showInvoice === 'function') window.showInvoice(savedIndex);
                    if (typeof window.updateInvoiceNavButtons === 'function') window.updateInvoiceNavButtons();
                }
            }
        } catch(e){ console.warn('Reload after update failed', e); }

        console.log('Invoice update completed for', invoiceNumber);
        return true;
    }

    // Update current invoice (convenience)
    window.updateCurrentInvoiceOnSheet = async function() {
        const inv = document.getElementById('invoiceNumber') ? (document.getElementById('invoiceNumber').value || '').trim() : '';
        if (!inv) { alert('No invoice selected'); return false; }
        return updateInvoiceOnSheet(inv);
    };

    window.updateInvoiceOnSheet = updateInvoiceOnSheet;

    console.log('✅ update_invoice module loaded');
})();
