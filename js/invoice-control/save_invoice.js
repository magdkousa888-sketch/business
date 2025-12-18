// save_invoice.js — extracted saveCurrentInvoice implementation
(function () {
    'use strict';

    // Exported function: saveCurrentInvoice
    async function saveCurrentInvoice() {
        try {
            // Gather form values (defensive lookups)
                // Helper: format date for sheet as DD/MM/YYYY (04/12/2025)
                function formatDateForSheet(input) {
                    if (!input && input !== 0) return '';
                    // If already a Date object
                    if (input instanceof Date) {
                        const d = input;
                        const dd = String(d.getDate()).padStart(2, '0');
                        const mm = String(d.getMonth() + 1).padStart(2, '0');
                        const yyyy = d.getFullYear();
                        return `${dd}/${mm}/${yyyy}`;
                    }
                    const s = String(input).trim();
                    // ISO YYYY-MM-DD
                    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
                        const [y, m, d] = s.split('-');
                        return `${d.padStart(2,'0')}/${m.padStart(2,'0')}/${y}`;
                    }
                    // Already dd/mm/yyyy? return as is
                    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) return s;
                    // Try Date.parse
                    const tryDate = new Date(s);
                    if (!isNaN(tryDate)) return formatDateForSheet(tryDate);
                    return s; // fallback - return raw
                }
            const getVal = (id, defaultVal = '') => {
                const el = document.getElementById(id);
                if (!el) return defaultVal;
                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return (el.value || '').trim();
                return (el.textContent || el.innerText || '').trim();
            };

            const invoiceNumber = getVal('invoiceNumber', '');
            const invoiceDate = formatDateForSheet(getVal('invoiceDate', ''));
            const dueDate = formatDateForSheet(getVal('dueDate', ''));
            const paymentTerms = getVal('terms', '');
            const vatNo = getVal('vatNo', '');
            const customerName = getVal('clientNameDisplay', '');
            const clientAddress = getVal('clientAddressDisplay', '').replace(/\n/g, ' ');
            const clientTRN = getVal('clientTRNDisplay', '').replace(/^TRN\s*/i, '');
            const clientCountry = getVal('clientCountryDisplay', '');
            const emirate = getVal('emirateDropdown', '');
            const vatTreatment = getVal('vatTreatmentDropdown', '');
            const invoiceStatus = getVal('invoiceStatusDropdown', '');
            const projectCode = getVal('projectCodeInput', '');
            const notes = getVal('notesText', '');

            // Validate items
            const tbody = document.getElementById('itemsTable');
            const rows = tbody ? Array.from(tbody.querySelectorAll('tr')) : [];
            const validItems = [];
            const itemErrors = [];

            const missingMainFields = [];
            if (!invoiceNumber) missingMainFields.push('Invoice Number');
            if (!customerName) missingMainFields.push('Client Name');
            if (!invoiceDate) missingMainFields.push('Invoice Date');
            if (!emirate) missingMainFields.push('Place of Supply');
            if (!vatTreatment) missingMainFields.push('VAT Treatment');

            if (rows.length === 0) {
                missingMainFields.push('At least one line item');
            } else {
                rows.forEach((row, idx) => {
                    const desc = row.querySelector('.desc-input') ? row.querySelector('.desc-input').value.trim() : '';
                    const qty = row.querySelector('.qty-input') ? parseFloat(row.querySelector('.qty-input').value) || 0 : 0;
                    const rate = row.querySelector('.rate-input') ? parseFloat(row.querySelector('.rate-input').value) || 0 : 0;
                    const taxPercent = row.querySelector('.tax-percent-input') ? row.querySelector('.tax-percent-input').value.trim() : '';

                    const hasAny = desc || qty > 0 || rate > 0 || taxPercent;
                    if (!hasAny) return; // skip empty rows

                    const itemMissing = [];
                    if (!desc) itemMissing.push('Description');
                    if (qty <= 0) itemMissing.push('Quantity (must be > 0)');
                    if (rate <= 0) itemMissing.push('Rate/Amount (must be > 0)');
                    if (!taxPercent) itemMissing.push('Tax %');

                    if (itemMissing.length > 0) {
                        itemErrors.push(`Line Item ${idx + 1}: Missing ${itemMissing.join(', ')}`);
                    } else {
                        validItems.push(row);
                    }
                });

                if (validItems.length === 0) missingMainFields.push('At least one complete line item (Description, Qty>0, Rate>0, Tax%)');
            }

            const allErrors = [...missingMainFields, ...itemErrors];
            if (allErrors.length > 0) {
                let errorMessage = '❌ Cannot save invoice. Please fix the following issues:\n\n';
                errorMessage += '📋 REQUIRED FIELDS:\n• Description (for each item)\n• Client Name\n• Invoice Date\n• Quantity > 0 (for each item)\n• Rate/Amount > 0 (for each item)\n• Tax % (for each item)\n• Place of Supply\n• VAT Treatment\n\n';
                errorMessage += '🚫 MISSING/INVALID DATA:\n';
                allErrors.forEach(err => { errorMessage += `• ${err}\n`; });
                errorMessage += '\n✅ Please fill all required fields before saving.';
                alert(errorMessage);
                if (typeof window.highlightMissingFields === 'function') window.highlightMissingFields(missingMainFields, itemErrors);
                return false;
            }

            // Prevent saving a newly created or cloned invoice as 'Closed'
            try {
                if (window.isNewInvoiceMode && (invoiceStatus || '').toString().trim() === 'Closed') {
                    alert('❌ New or cloned invoices cannot be saved with status "Closed". Please set status to Draft or Sent before saving.');
                    // Ensure UI reflects policy
                    if (typeof window.setInvoiceStatusClosedAllowed === 'function') window.setInvoiceStatusClosedAllowed(false);
                    return false;
                }
            } catch (e) { console.warn('Error checking new-invoice Closed policy', e); }

            // Check for duplicate
            const existingInvoice = (window.allInvoices || []).find(inv => inv['Invoice Number'] === invoiceNumber);
            if (existingInvoice) {
                // Build context for the dialog
                const currentInvoiceData = { invoiceNumber, invoiceDate, dueDate, paymentTerms, vatNo, customerName, clientAddress, clientTRN, emirate, vatTreatment, invoiceStatus, projectCode, notes, validItems };
                if (typeof window.showDuplicateInvoiceDialog === 'function') {
                    window.showDuplicateInvoiceDialog(currentInvoiceData);
                } else {
                    alert('Duplicate invoice detected — cannot save.');
                }
                return false;
            }

            // create invoice data object
            const invoiceDataObj = { invoiceDate, dueDate, paymentTerms, vatNo, customerName, clientAddress, clientTRN, emirate, vatTreatment, invoiceStatus, projectCode, notes };

            // Save via existing helper (must be available in global scope)
            if (typeof window.saveInvoiceData === 'function') {
                const saveSuccess = window.saveInvoiceData(invoiceNumber, validItems, invoiceDataObj, true);
                if (saveSuccess) {
                    // Append the newly saved invoice rows to Google Sheets using client-side API
                    try {
                        // Build exact rows matching the data structure
                        const createdDate = formatDateForSheet(new Date());
                        const entryType = 'Manual Entry';
                        const createdBy = 'magdkousa888-sketch';

                        // Default values from Mapping example.txt
                        const defaults = {
                            "Invoice Date": (invoiceDate ? formatDateForSheet(invoiceDate) : '18/02/2025'),
                            "Invoice ID": '',
                            "Invoice Number": invoiceNumber || 'INV-0000400',
                            "Invoice Status": invoiceStatus || 'Sent',
                            "Customer ID": '',
                            "Customer Name": customerName || '',
                            "Is Inclusive Tax": 'FALSE',
                            "Due Date": (dueDate ? formatDateForSheet(dueDate) : (invoiceDate ? formatDateForSheet(invoiceDate) : '')),
                            "PurchaseOrder": '',
                            "Currency Code": 'AED',
                            "Exchange Rate": '1',
                            "Discount Type": 'item_level',
                            "Is Discount Before Tax": 'TRUE',
                            "Template Name": 'Standard Template',
                            "Entity Discount Percent": '0',
                            "SubTotal": '',
                            "Total": '',
                            "TotalRetentionAmountFCY": '0',
                            "TotalRetentionAmountBCY": '0',
                            "Balance": '0',
                            "Adjustment": '0',
                            "Adjustment Description": 'Adjustment',
                            "Expected Payment Date": '',
                            "Last Payment Date": '',
                            "Payment Terms": paymentTerms || '0',
                            "Payment Terms Label": 'Due On Receipt',
                            "Notes": notes || "Thanks for your business.\nThis is an electronically generated invoice no signature or stamp is required",
                            "Terms & Conditions": 'Bank Account Details\nBank Name: Emirates NBD\nIBAN: AE360260001015867786601\nAccount No: 1015867786601',
                            "Invoice Type": 'Invoice',
                            "Entity Discount Amount": '0',
                            "Shipping Charge": '0',
                            "Item Name": '',
                            "Item Desc": '',
                            "Quantity": '',
                            "Discount": '0',
                            "Discount Amount": '0',
                            "Item Total": '',
                            "Non Taxable Amount": '',
                            "Usage unit": '',
                            "Item Price": '',
                            "Product ID": '',
                            "Brand": '',
                            "Sales Order Number": '',
                            "subscription_id": '',
                            "Expense Reference ID": '',
                            "Recurrence Name": '',
                            "Billing Attention": '',
                            "Billing Address": clientAddress || '',
                            "Billing Street2": '',
                            "Billing City": '',
                            "Billing State": 'Dubai',
                            "Billing Country": 'United Arab Emirates',
                            "Billing Code": '',
                            "Billing Phone": '',
                            "Billing Fax": '',
                            "Shipping Attention": '',
                            "Shipping Address": '',
                            "Shipping Street2": '',
                            "Shipping City": '',
                            "Shipping State": '',
                            "Shipping Country": '',
                            "Shipping Code": '',
                            "Shipping Fax": '',
                            "Shipping Phone Number": '',
                            "Reverse Charge Tax Name": '',
                            "Reverse Charge Tax Rate": '',
                            "Reverse Charge Tax Type": '',
                            "Invoice Level Tax": '',
                            "Invoice Level Tax %": '',
                            "Invoice Level Tax Type": '',
                            "Invoice Level Tax Exemption Reason": '',
                            "Project ID": '',
                            "Project Name": projectCode || '',
                            "Round Off": '0',
                            "Sales person": '',
                            "Subject": '',
                            "Primary Contact EmailID": '',
                            "Primary Contact Mobile": '',
                            "Primary Contact Phone": '',
                            "Estimate Number": '',
                            "Item Type": 'service',
                            "Custom Charges": '',
                            "Shipping Bill#": '',
                            "Shipping Bill Date": '',
                            "Shipping Bill Total": '',
                            "PortCode": '',
                            "Reference Invoice#": '',
                            "Reference Invoice Date": '',
                            "GST Registration Number(Reference Invoice)": '',
                            "VAT Treatment": vatTreatment || 'vat_not_registered',
                            "Place Of Supply": '',
                            "Tax Registration Number": clientTRN || vatNo || '',
                            "Account": 'Sales',
                            "Account Code": '',
                            "Tax ID": '5.12817E+18',
                            "Item Tax": 'Standard Rate',
                            "Item Tax %": '5',
                            "Item Tax Amount": '7.5',
                            "Item Tax Type": 'ItemAmount',
                            "Item Tax Exemption Reason": '',
                            "Out of Scope Reason": '',
                            "Kit Combo Item Name": '',
                            "Created By": 'magdkousa888-sketch',
                            "Entry Type": 'Manual Entry'
                        };

                        // Compute invoice-level totals (subtotal and tax) from the validated rows
                        let invoiceSubtotal = 0;
                        let invoiceTaxTotal = 0;
                        validItems.forEach(r => {
                            const q = r.querySelector('.qty-input') ? parseFloat(r.querySelector('.qty-input').value) || 0 : 0;
                            const p = r.querySelector('.rate-input') ? parseFloat(r.querySelector('.rate-input').value) || 0 : 0;
                            const d = r.querySelector('.discount-input') ? parseFloat(r.querySelector('.discount-input').value) || 0 : 0;
                            const taxPercentStr = r.querySelector('.tax-percent-input') ? r.querySelector('.tax-percent-input').value.trim() : '';
                            const taxableEl = r.querySelector('.taxable-amount');
                            const taxableCandidate = taxableEl ? parseFloat((taxableEl.textContent || '').replace(/\u00A0/g, ' ').replace(/,/g, '').trim()) || 0 : 0;
                            const taxable = (taxableCandidate > 0) ? taxableCandidate : Math.max(0, q * p - d);
                            const taxPercentNum = (taxPercentStr === '-' || taxPercentStr === '') ? 0 : (parseFloat(taxPercentStr) || 0);
                            const taxAmtNum = taxPercentNum > 0 ? (taxable * (taxPercentNum / 100)) : 0;
                            invoiceSubtotal += taxable;
                            invoiceTaxTotal += taxAmtNum;
                        });
                        const invoiceTotal = invoiceSubtotal + invoiceTaxTotal;

                        // Save computed totals into defaults
                        defaults["SubTotal"] = invoiceSubtotal.toFixed(2);
                        defaults["Total"] = invoiceTotal.toFixed(2);
                        defaults["Billing Country"] = (clientCountry && clientCountry.trim()) ? clientCountry : defaults["Billing Country"];

                        const rowsToAppend = validItems.map(row => {
                            const desc = row.querySelector('.desc-input') ? row.querySelector('.desc-input').value.trim() : '';
                            const qty = row.querySelector('.qty-input') ? row.querySelector('.qty-input').value.trim() : '';
                            const rate = row.querySelector('.rate-input') ? row.querySelector('.rate-input').value.trim() : '';
                            const discount = row.querySelector('.discount-input') ? row.querySelector('.discount-input').value.trim() : '0';
                            const taxPercent = row.querySelector('.tax-percent-input') ? row.querySelector('.tax-percent-input').value.trim() : '';
                            const taxableElRow = row.querySelector('.taxable-amount');
                            const taxable = taxableElRow ? (taxableElRow.textContent || '').replace(/\u00A0/g, ' ').replace(/,/g, '').trim() : '';
                            const taxElRow = row.querySelector('.tax-amount');
                            const taxAmt = taxElRow ? (taxElRow.textContent || '').replace(/\u00A0/g, ' ').replace(/,/g, '').trim() : '';

                            // Compute place of supply mapping — sync as two-letter emirate code (first 2 letters uppercase)
                            let placeOfSupply = emirate ? String(emirate).trim().substring(0,2).toUpperCase() : '';
                            if (!placeOfSupply) placeOfSupply = 'DU';

                            // Compose the full row using defaults + actuals
                            const obj = Object.assign({}, defaults);

                            obj["Item Desc"] = desc || defaults["Item Desc"];
                            obj["Quantity"] = qty || defaults["Quantity"] || '1';
                            obj["Item Price"] = rate || defaults["Item Price"];
                            obj["Discount"] = discount || defaults["Discount"];
                            obj["Discount Amount"] = discount || defaults["Discount Amount"];
                            
                            const qtyNum = parseFloat(qty) || 0;
                            const rateNum = parseFloat(rate) || 0;
                            const discountNum = parseFloat(discount) || 0;
                            const taxableNum = (taxable && String(taxable).trim() !== '') ? parseFloat(taxable) || 0 : Math.max(0, qtyNum * rateNum - discountNum);
                            const taxPercentNum = (taxPercent === '-' || taxPercent === '') ? 0 : (parseFloat(taxPercent) || 0);
                            const itemTaxAmountNum = taxPercentNum > 0 ? (taxableNum * (taxPercentNum / 100)) : 0;

                            obj["Item Total"] = (qtyNum * rateNum - discountNum).toFixed(2);
                            obj["Taxable Amount"] = taxableNum.toFixed(2);
                            // Map Item Tax string based on percent: '-' => exempt (no percent), 5 -> 'standard rate', 0 -> 'zero rate'
                            let mappedTax = '';
                            let mappedPct = '';
                            if (taxPercent === '-' || taxPercent === '') {
                                mappedTax = 'exempt';
                                mappedPct = '';
                            } else {
                                const tp = parseFloat(taxPercent) || 0;
                                if (Math.abs(tp - 5) < 0.0001) { mappedTax = 'standard rate'; mappedPct = '5'; }
                                else if (Math.abs(tp - 0) < 0.0001) { mappedTax = 'zero rate'; mappedPct = '0'; }
                                else { mappedTax = 'exempt'; mappedPct = ''; }
                            }
                            obj["Item Tax"] = mappedTax || defaults["Item Tax"];
                            obj["Item Tax %"] = mappedPct;
                            obj["Item Tax Amount"] = (taxAmt && String(taxAmt).trim() !== '') ? (parseFloat(taxAmt).toFixed(2)) : itemTaxAmountNum.toFixed(2);

                            obj["Invoice Date"] = invoiceDate || defaults["Invoice Date"];
                            obj["Due Date"] = dueDate || defaults["Due Date"];
                            obj["Invoice Number"] = invoiceNumber || defaults["Invoice Number"];
                            obj["Invoice Status"] = invoiceStatus || defaults["Invoice Status"];
                            obj["Customer Name"] = customerName || defaults["Customer Name"];
                            obj["Billing Address"] = clientAddress || defaults["Billing Address"];
                            obj["Billing Country"] = (clientCountry && clientCountry.trim()) ? clientCountry : (clientAddress && clientAddress.toLowerCase().includes('united arab emirates') ? 'United Arab Emirates' : (defaults["Billing Country"] || ''));
                            obj["Billing Phone"] = (clientTRN ? '' : '') || defaults["Billing Phone"];
                            obj["Payment Terms"] = paymentTerms || defaults["Payment Terms"];
                            obj["Notes"] = notes || defaults["Notes"];
                            obj["VAT Treatment"] = vatTreatment || defaults["VAT Treatment"];
                            // Prefer the client's TRN when available (clientTRN may contain selected client's TRN),
                            // otherwise fall back to the vatNo field.
                            obj["Tax Registration Number"] = (typeof clientTRN !== 'undefined' && clientTRN) ? clientTRN : (vatNo || defaults["Tax Registration Number"]);
                            obj["Project Name"] = projectCode || defaults["Project Name"];
                            obj["Place Of Supply"] = placeOfSupply || 'DU';

                            obj["SubTotal"] = defaults["SubTotal"];
                            obj["Total"] = defaults["Total"];

                            obj["Created By"] = defaults["Created By"] || 'magdkousa888-sketch';
                            obj["Created Date"] = createdDate;
                            obj["Last Modified"] = obj["Created Date"];
                            obj["Entry Type"] = defaults["Entry Type"] || 'Manual Entry';

                            return obj;
                        }).filter(r => Object.keys(r).length > 0);

                        if (rowsToAppend.length > 0) {
                            // Append to Google Sheets using service account
                            try {
                                if (!window.ServiceAccountAuth) {
                                    throw new Error('ServiceAccountAuth not loaded');
                                }

                                const SPREADSHEET_ID = window.GOOGLE_SPREADSHEET_ID || '17gh8MZSeFVPQudyTGwYf5_pFWH8yt-xpCPiPy9i8x-U';
                                const SHEET_NAME = 'Invoices';
                                
                                // Use the correct column order from Columns index.csv (legacy HEADER_ORDER is fallback)
                                const HEADER_ORDER = [
                                    "Invoice Date", "Invoice ID", "Invoice Number", "Invoice Status", "Customer ID", "Customer Name", "Is Inclusive Tax",
                                    "Due Date", "PurchaseOrder", "Currency Code", "Exchange Rate", "Discount Type", "Is Discount Before Tax", "Template Name",
                                    "Entity Discount Percent", "SubTotal", "Total", "TotalRetentionAmountFCY", "TotalRetentionAmountBCY", "Balance",
                                    "Adjustment", "Adjustment Description", "Expected Payment Date", "Last Payment Date", "Payment Terms", "Payment Terms Label",
                                    "Notes", "Terms & Conditions", "Invoice Type", "Entity Discount Amount", "Shipping Charge", "Item Name", "Item Desc",
                                    "Quantity", "Discount", "Discount Amount", "Item Total", "Non Taxable Amount", "Usage unit", "Item Price", "Product ID",
                                    "Brand", "Sales Order Number", "subscription_id", "Expense Reference ID", "Recurrence Name", "PayPal", "Authorize.Net",
                                    "Google Checkout", "Payflow Pro", "Stripe", "Paytm", "2Checkout", "Braintree", "Forte", "WorldPay", "Payments Pro",
                                    "Square", "WePay", "Razorpay", "ICICI EazyPay", "GoCardless", "Partial Payments", "Billing Attention", "Billing Address",
                                    "Billing Street2", "Billing City", "Billing State", "Billing Country", "Billing Code", "Billing Phone", "Billing Fax",
                                    "Shipping Attention", "Shipping Address", "Shipping Street2", "Shipping City", "Shipping State", "Shipping Country",
                                    "Shipping Code", "Shipping Fax", "Shipping Phone Number", "Reverse Charge Tax Name", "Reverse Charge Tax Rate",
                                    "Reverse Charge Tax Type", "Invoice Level Tax", "Invoice Level Tax %", "Invoice Level Tax Type",
                                    "Invoice Level Tax Exemption Reason", "Project ID", "Project Name", "Round Off", "Sales person", "Subject",
                                    "Primary Contact EmailID", "Primary Contact Mobile", "Primary Contact Phone", "Estimate Number", "Item Type",
                                    "Custom Charges", "Shipping Bill#", "Shipping Bill Date", "Shipping Bill Total", "PortCode", "Reference Invoice#",
                                    "Reference Invoice Date", "GST Registration Number(Reference Invoice)", "VAT Treatment", "Place Of Supply",
                                    "Tax Registration Number", "Account", "Account Code", "Tax ID", "Item Tax", "Item Tax %", "Item Tax Amount",
                                    "Item Tax Type", "Item Tax Exemption Reason", "Out of Scope Reason", "Kit Combo Item Name", "Created By",
                                    "Created Date", "Last Modified", "Entry Type"
                                ];
                                
                                // Helper: compute final invoice row array given an invoice object and optional indexMap
                                function getInvoiceAppendRow(invoiceObj, { preferIndexMap = true, indexMap = null } = {}){
                                    try {
                                        let resolvedIndexMap = indexMap;
                                        if (!resolvedIndexMap && typeof window.getColumnsIndexCached === 'function') resolvedIndexMap = window.getColumnsIndexCached('Invoices') || null;
                                        if (resolvedIndexMap && Object.keys(resolvedIndexMap).length > 0 && preferIndexMap) {
                                            const numericKeys = Object.keys(resolvedIndexMap).filter(k => Number.isFinite(resolvedIndexMap[k]));
                                            if (numericKeys.length > 0) {
                                                const maxIndex = Math.max(...numericKeys.map(k => resolvedIndexMap[k]));
                                                const arr = new Array(maxIndex + 1).fill('');
                                                const objNorm = {};
                                                Object.keys(invoiceObj || {}).forEach(key => objNorm[String(key).trim().toLowerCase()] = invoiceObj[key]);
                                                // Normalize TRN synonyms into canonical 'tax registration number'
                                                if ((!objNorm['tax registration number'] || objNorm['tax registration number'] === '')) {
                                                    const candidates = ['client trn', 'client trn number', 'billing trn', 'billing trn number', 'trn number', 'trn', 'client trn'];
                                                    for (let c of candidates) { if (objNorm[c]) { objNorm['tax registration number'] = objNorm[c]; break; } }
                                                }
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
                                    } catch (e) { console.warn('getInvoiceAppendRow helper error', e); return null; }
                                }

                                // Try to use a client-side Columns Index mapping first (preferred)
                                let rows = null;
                                    try {
                                        // Prefer a fresh mapping from Columns Index sheet to avoid stale cached indexes
                                        let indexMap = null;
                                        if (typeof window.loadColumnsIndexFromSheet === 'function') {
                                            try {
                                                indexMap = await window.loadColumnsIndexFromSheet('Invoices', { force: true });
                                            } catch (e) {
                                                console.warn('Could not force-load Columns Index for Invoices (fall back to cache):', e && e.message ? e.message : e);
                                                if (typeof window.getColumnsIndexCached === 'function') indexMap = window.getColumnsIndexCached('Invoices') || null;
                                            }
                                        } else if (typeof window.getColumnsIndexCached === 'function') {
                                            indexMap = window.getColumnsIndexCached('Invoices') || null;
                                        }

                                    // If we have a mapping with some numeric indexes, use it
                                    const numericKeys = indexMap ? Object.keys(indexMap).filter(k => Number.isFinite(indexMap[k])) : [];
                                    if (indexMap && numericKeys.length > 0) {
                                        // Normalize mapping keys to lowercase for robust matching
                                        const normalizedMap = {};
                                        numericKeys.forEach(k => {
                                            normalizedMap[String(k).trim().toLowerCase()] = indexMap[k];
                                        });

                                        // Use helper to produce rows (resolves synonyms and indexMap usage)
                                        rows = rowsToAppend.map(obj => getInvoiceAppendRow(obj, { preferIndexMap: true, indexMap: indexMap }));
                                        console.log('✅ Using client Columns Index mapping for Invoices — mapped arrays produced');
                                    }
                                } catch (err) {
                                    console.warn('Error applying client Columns Index mapping:', err);
                                    rows = null;
                                }

                                // If mapping failed or produced no numeric index data, fall back to legacy HEADER_ORDER mapping
                                if (!rows || !Array.isArray(rows) || rows.length === 0) {
                                    rows = rowsToAppend.map(obj => HEADER_ORDER.map(h => obj[h] !== undefined && obj[h] !== null ? String(obj[h]) : ''));
                                }

                                const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_NAME}!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
                                
                                // Diagnostic preview before append — helps ensure required fields (e.g. Tax Registration Number) are present
                                try {
                                    console.log('DEBUG: Invoices append preview', {
                                        dataset: 'Invoices',
                                        rowCount: Array.isArray(rows) ? rows.length : 0,
                                        sampleRow: Array.isArray(rows) && rows[0] ? rows[0].slice(0, 30) : rows[0]
                                    });
                                } catch (e) { console.warn('Failed to create invoices append preview', e); }

                                // If in preview mode, don't actually POST — just log and continue
                                if (window.DEBUG_PREVIEW_APPEND === true) {
                                    console.log('DEBUG_PREVIEW_APPEND set — skipping actual invoice append (non-destructive)');
                                } else {
                                    const response = await window.ServiceAccountAuth.fetch(appendUrl, {
                                        method: 'POST',
                                        body: JSON.stringify({ values: rows })
                                    });

                                    if (!response.ok) {
                                        const error = await response.json().catch(() => ({}));
                                        throw new Error(error.error?.message || `Failed to append: ${response.status}`);
                                    }

                                    const result = await response.json();
                                    console.log(`✅ Appended ${rows.length} rows to Google Sheets`);
                                }
                                
                                // Reload data from Google Sheets to get the saved invoice
                                console.log('🔄 Reloading data from Google Sheets...');
                                if (window.dataLoader && typeof window.dataLoader.loadFromGoogleSheets === 'function') {
                                    const statusEl = document.getElementById('sheetsLoadStatus');
                                    await window.dataLoader.loadFromGoogleSheets(statusEl);
                                    
                                    // After reload, find and display the saved invoice
                                    if (typeof window.updateUniqueInvoiceNumbers === 'function') {
                                        window.updateUniqueInvoiceNumbers();
                                    }
                                    if (Array.isArray(window.uniqueInvoiceNumbers)) {
                                        const savedIndex = window.uniqueInvoiceNumbers.indexOf(invoiceNumber);
                                        if (savedIndex !== -1) {
                                            window.currentInvoiceIndex = savedIndex;
                                            if (typeof window.showInvoice === 'function') {
                                                window.showInvoice(savedIndex);
                                            }
                                            if (typeof window.updateInvoiceNavButtons === 'function') {
                                                window.updateInvoiceNavButtons();
                                            }
                                            console.log(`📋 Displaying saved invoice: ${invoiceNumber} at index ${savedIndex}`);
                                            // Clear new-invoice dirty flag after successful save/display
                                            try { window.newInvoiceDirty = false; } catch (e) {}
                                        }
                                    }
                                }
                                
                                //alert(`✅ Saved invoice ${invoiceNumber} and appended ${rows.length} row(s) to Google Sheets!`);
                                
                            } catch (err) {
                                console.error('Failed to append to Google Sheets:', err);
                                alert(`⚠️ Saved invoice ${invoiceNumber} locally, but failed to append to Google Sheets:\n\n${err.message}`);
                            }
                        }
                    } catch (err) {
                        console.warn('Error while appending to Google Sheets', err);
                        alert(`⚠️ Saved invoice ${invoiceNumber} locally but failed to append to Google Sheets (see console).`);
                    }

                                        // run post-save actions
                                        try {
                                            if (window.sessionLogger && typeof window.sessionLogger.appendEvent === 'function') {
                                                // non-blocking fire-and-forget
                                                window.sessionLogger.appendEvent('add_invoice', { invoiceNumber: invoiceNumber, customerName: customerName, total: defaults["Total"] || invoiceTotal || '' });
                                            }
                                        } catch(e){ console.warn('session_logger appendEvent failed for add_invoice', e); }
                                        if (typeof window.postSaveActions === 'function') window.postSaveActions(invoiceNumber, customerName, validItems.length, false, true);
                    return true;
                }
                return false;
            } else {
                console.error('saveInvoiceData() is not available — cannot persist invoice');
                alert('Internal error: cannot save invoice (missing save helper). See console.');
                return false;
            }

        } catch (err) {
            console.error('Unexpected error in saveCurrentInvoice:', err);
            alert('Unexpected error while saving invoice — see console for details.');
            return false;
        }
    }

    // Backwards-compatible fallback for saveInvoiceData
    // If another implementation exists (e.g. server flow), keep it. Otherwise provide
    // a minimal in-memory persistence implementation so the UI can save and navigate.
    if (typeof window.saveInvoiceData !== 'function') {
        window.saveInvoiceData = function(invoiceNumber, validItems, invoiceDataObj, persistToStorage = true) {
            try {
                if (!invoiceNumber) return false;
                window.allInvoices = window.allInvoices || [];

                const rows = [];
                // Convert DOM rows to canonical objects
                if (Array.isArray(validItems) && validItems.length > 0 && validItems[0] && validItems[0].querySelector) {
                    validItems.forEach(r => {
                        const desc = r.querySelector('.desc-input') ? (r.querySelector('.desc-input').value || '').trim() : '';
                        const qty = r.querySelector('.qty-input') ? (r.querySelector('.qty-input').value || '').trim() : '';
                        const rate = r.querySelector('.rate-input') ? (r.querySelector('.rate-input').value || '').trim() : '';
                        const discount = r.querySelector('.discount-input') ? (r.querySelector('.discount-input').value || '').trim() : '0';
                        const taxPercent = r.querySelector('.tax-percent-input') ? (r.querySelector('.tax-percent-input').value || '').trim() : '';
                        const taxableEl = r.querySelector('.taxable-amount');
                        const taxable = taxableEl ? ((taxableEl.textContent || '').replace(/\u00A0/g,' ').replace(/,/g,'')) : '';
                        const taxEl = r.querySelector('.tax-amount');
                        const taxAmt = taxEl ? ((taxEl.textContent || '').replace(/\u00A0/g,' ').replace(/,/g,'')) : '';

                        rows.push(Object.assign({}, invoiceDataObj || {}, {
                            'Invoice Number': invoiceNumber,
                            'Item Desc': desc,
                            'Quantity': qty || '1',
                            'Item Price': rate || '',
                            'Discount': discount || '0',
                            'Taxable Amount': taxable || '',
                            'Item Tax Amount': taxAmt || '',
                            'Item Tax %': taxPercent || '',
                            'Invoice Date': invoiceDataObj && invoiceDataObj.invoiceDate ? invoiceDataObj.invoiceDate : '',
                            'Place Of Supply': invoiceDataObj && invoiceDataObj.emirate ? invoiceDataObj.emirate : '',
                            'VAT Treatment': invoiceDataObj && invoiceDataObj.vatTreatment ? invoiceDataObj.vatTreatment : ''
                        }));
                    });
                } else if (Array.isArray(validItems) && validItems.length > 0) {
                    // Already objects
                    validItems.forEach(r => {
                        const row = Object.assign({}, invoiceDataObj || {}, r);
                        row['Invoice Number'] = invoiceNumber;
                        rows.push(row);
                    });
                }

                if (rows.length === 0) return false;

                window.allInvoices.push(...rows);

                if (typeof window.updateUniqueInvoiceNumbers === 'function') window.updateUniqueInvoiceNumbers();

                // Do not force-show the saved invoice here. Only update nav buttons.
                if (persistToStorage && window.invoiceStorageManager && typeof window.invoiceStorageManager.saveInvoicesToStorage === 'function') {
                    try { window.invoiceStorageManager.saveInvoicesToStorage(); } catch(e) { console.warn('saveInvoiceData: storage save failed', e); }
                }

                if (typeof window.updateInvoiceNavButtons === 'function') window.updateInvoiceNavButtons();
                return true;
            } catch (err) {
                console.error('saveInvoiceData fallback failed', err);
                return false;
            }
        };
    }

    // Expose the function on window so the existing UI and bindings continue to work
    window.saveCurrentInvoice = saveCurrentInvoice;

    console.log('✅ save_invoice module loaded (saveCurrentInvoice is now available)');

})();
