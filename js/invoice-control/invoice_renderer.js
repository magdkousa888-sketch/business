// Invoice rendering helpers extracted from invoice-control-panel.js
(function () {
    function formatNumberLocal(n) {
        if (typeof window.formatNumber === 'function') return window.formatNumber(n);
        return (typeof n === 'number') ? n.toFixed(2) : (n || '0.00');
    }

    // Sanitize numeric strings for number inputs (remove thousands separators and non-numeric chars)
    function sanitizeNumericForInput(v) {
      if (v == null) return '';
      let s = String(v).trim();
      if (s === '-') return '-';
      let negative = false;
      if (/^\(.*\)$/.test(s)) { negative = true; s = s.replace(/^\(|\)$/g, ''); }
      s = s.replace(/[^0-9.,\-]/g, '');
      if (s.indexOf('.') !== -1 && s.indexOf(',') !== -1) {
        if (s.lastIndexOf('.') < s.lastIndexOf(',')) {
          s = s.replace(/\./g, '').replace(/,/g, '.');
        } else {
          s = s.replace(/,/g, '');
        }
      } else if (s.indexOf(',') !== -1) {
        const parts = s.split(',');
        if (parts.length === 2 && parts[1].length <= 3) {
          s = parts[0] + '.' + parts[1];
        } else {
          s = s.replace(/,/g, '');
        }
      }
      s = s.replace(/[^0-9.\-]/g, '');
      if (negative) s = '-' + s;
      return s;
    }

    function clearInvoiceDisplay() {
        const el = id => document.getElementById(id);
        if (el('invoiceNumber')) el('invoiceNumber').value = "";
        if (el('invoiceDate')) el('invoiceDate').value = "";
        if (el('dueDate')) el('dueDate').value = "";
        if (el('terms')) el('terms').value = "";
        if (el('vatNo')) el('vatNo').value = "";
        if (el('clientNameDisplay')) el('clientNameDisplay').textContent = "No invoices available";
        if (el('clientAddressDisplay')) el('clientAddressDisplay').innerHTML = "";
        if (el('clientCountryDisplay')) { el('clientCountryDisplay').textContent = ''; el('clientCountryDisplay').style.display = 'none'; }
        if (el('clientTRNDisplay')) el('clientTRNDisplay').textContent = "";
        if (el('emirateDropdown')) el('emirateDropdown').value = "";
        if (el('vatTreatmentDropdown')) el('vatTreatmentDropdown').value = "";
        if (el('invoiceStatusDropdown')) el('invoiceStatusDropdown').value = "Draft";
        if (el('projectCodeInput')) el('projectCodeInput').value = "";
        if (el('projectCode')) el('projectCode').value = "";
        if (el('projectCodeDisplay')) el('projectCodeDisplay').textContent = "";
        if (el('notesText')) el('notesText').value = "";

        const tbody = document.getElementById('itemsTable');
        if (tbody) tbody.innerHTML = "";
        // Recalculate totals (payments module keeps balance separate)
        if (typeof window.calculateTotals === 'function') return window.calculateTotals();
    }

    function calculateTotals() {
        const rows = document.querySelectorAll('#itemsTable tr');
        let subtotal = 0, totalTax = 0, grandTotal = 0;

        rows.forEach((row, index) => {
            const qty = parseFloat(row.querySelector('.qty-input').value) || 0;
            const rate = parseFloat(row.querySelector('.rate-input').value) || 0;
            const discount = parseFloat(row.querySelector('.discount-input').value) || 0;
            const taxPercent = row.querySelector('.tax-percent-input').value;
            let taxRate = taxPercent === "-" ? "-" : parseFloat(taxPercent);
            let taxableAmount = qty * rate - discount;
            taxableAmount = taxableAmount < 0 ? 0 : taxableAmount;
            let taxAmount = (taxRate === "-" ? 0 : taxableAmount * (taxRate / 100));

            const desc = row.querySelector('.desc-input');
            if (desc && desc.nextElementSibling) desc.nextElementSibling.textContent = desc.value;
            const qtyEl = row.querySelector('.qty-input');
            if (qtyEl && qtyEl.nextElementSibling) qtyEl.nextElementSibling.textContent = qty;
            const rateEl = row.querySelector('.rate-input');
            if (rateEl && rateEl.nextElementSibling) rateEl.nextElementSibling.textContent = formatNumberLocal(rate);
            const discEl = row.querySelector('.discount-input');
            if (discEl && discEl.nextElementSibling) discEl.nextElementSibling.textContent = formatNumberLocal(discount);
            const taxPercentEl = row.querySelector('.tax-percent-input');
            if (taxPercentEl && taxPercentEl.nextElementSibling) taxPercentEl.nextElementSibling.textContent = (taxRate === "-" ? "-" : taxRate + "%");

            let taxableCell = row.querySelector('.taxable-amount');
            if (taxableCell) taxableCell.innerHTML = `<span class="value-for-screen">${formatNumberLocal(taxableAmount)}</span><span class="value-for-print" style="display:none">${formatNumberLocal(taxableAmount)}</span>`;

            let taxCell = row.querySelector('.tax-amount');
            const taxDisplayValue = (taxRate === "-" ? "-" : formatNumberLocal(taxAmount));
            if (taxCell) taxCell.innerHTML = `<span class="value-for-screen">${taxDisplayValue}</span><span class="value-for-print" style="display:none">${taxDisplayValue}</span>`;
            if (taxableCell) taxableCell.setAttribute('data-print-value', formatNumberLocal(taxableAmount));
            if (taxCell) taxCell.setAttribute('data-print-value', taxRate === "-" ? "-" : formatNumberLocal(taxAmount));

            // Update per-row total cell (taxable + tax)
            const rowTotal = taxableAmount + (taxRate === "-" ? 0 : taxAmount);
            const totalDisplay = (taxRate === "-" ? formatNumberLocal(taxableAmount) : formatNumberLocal(rowTotal));
            const totalCell = row.querySelector('.line-total');
            if (totalCell) totalCell.innerHTML = `<span class="value-for-screen">${totalDisplay}</span><span class="value-for-print" style="display:none">${totalDisplay}</span>`;
            if (totalCell) totalCell.setAttribute('data-print-value', totalDisplay);

            const firstTd = row.querySelector('td:first-child');
            if (firstTd) firstTd.textContent = index + 1;
            subtotal += taxableAmount;
            if (taxRate !== "-") totalTax += taxAmount;
        });

        grandTotal = subtotal + totalTax;
        if (document.getElementById('subtotal')) document.getElementById('subtotal').textContent = formatNumberLocal(subtotal);
        if (document.getElementById('totalTax')) document.getElementById('totalTax').textContent = formatNumberLocal(totalTax);
        if (document.getElementById('grandTotal')) document.getElementById('grandTotal').textContent = formatNumberLocal(grandTotal);
    }

    function updateInvoiceDisplayFields() {
        const get = id => document.getElementById(id);
        
        // Parse and set Place of Supply
        const emirateDropdown = get('emirateDropdown');
        if (emirateDropdown) {
            const placeOfSupply = emirateDropdown.value || "";
            
            // Auto-parse "DU" as Dubai
            let parsedPlace = placeOfSupply;
            if (placeOfSupply.toUpperCase() === "DU") {
                parsedPlace = "Dubai";
                emirateDropdown.value = "Dubai";
            }
            
            if (get('invoiceEmirateDisplay')) {
                get('invoiceEmirateDisplay').textContent = parsedPlace;
            }
        }
        
        // Parse and set VAT Treatment
        if (get('invoiceVatTreatmentDisplay')) {
            get('invoiceVatTreatmentDisplay').textContent = (get('vatTreatmentDropdown') && get('vatTreatmentDropdown').value) || "";
        }
        
        // Parse and set Invoice Status (default to "Sent" if empty)
        const statusDropdown = get('invoiceStatusDropdown');
        if (statusDropdown) {
            if (!statusDropdown.value || statusDropdown.value === "") {
                statusDropdown.value = "Sent";
            }
            if (get('invoiceStatusDisplay')) {
                get('invoiceStatusDisplay').textContent = statusDropdown.value;
            }
        }
    }

    function showInvoice(idx) {
        if (typeof window.activateClientSection === 'function') window.activateClientSection();
        if (typeof window.updateUniqueInvoiceNumbers === 'function') window.updateUniqueInvoiceNumbers();

        // Keep canonical current index on window
        window.currentInvoiceIndex = idx;
        window.isNewInvoiceMode = false;  // Viewing existing invoice, not creating new

        // Use filtered invoices if filters are active, otherwise use all unique invoices
        const useFiltered = window.isFiltered && Array.isArray(window.filteredInvoiceNumbers) && window.filteredInvoiceNumbers.length > 0;
        const u = useFiltered ? window.filteredInvoiceNumbers : (Array.isArray(window.uniqueInvoiceNumbers) ? window.uniqueInvoiceNumbers : []);
        
        if (u.length === 0) { clearInvoiceDisplay(); return; }
        if (idx < 0 || idx >= u.length) return;

        const invoiceNo = u[idx];
        console.log(`Loading invoice ${invoiceNo} from table data` + (useFiltered ? ' (filtered)' : ''));

        const items = (Array.isArray(window.allInvoices) ? window.allInvoices : []).filter(i => i["Invoice Number"] === invoiceNo);
        if (items.length === 0) { console.log(`No items found for invoice ${invoiceNo}`); return; }

        const inv = items[0];

        const el = id => document.getElementById(id);
        if (el('invoiceNumber')) el('invoiceNumber').value = inv["Invoice Number"] || "";
        if (el('invoiceDate')) el('invoiceDate').value = (typeof window.normalizeDateForInput === 'function') ? window.normalizeDateForInput(inv["Invoice Date"]) : (inv["Invoice Date"] || "");
        if (el('dueDate')) el('dueDate').value = (typeof window.normalizeDateForInput === 'function') ? window.normalizeDateForInput(inv["Due Date"]) : (inv["Due Date"] || "");
        if (el('terms')) el('terms').value = inv["Payment Terms Label"] || inv["Payment Terms"] || inv["Terms"] || "";
        if (el('vatNo')) el('vatNo').value = inv["Tax Registration Number"] || "";
        
        // Parse Place of Supply - handle "DU" as Dubai
        let placeOfSupply = inv["Place Of Supply"] || "";
        if (placeOfSupply.toUpperCase() === "DU") {
            placeOfSupply = "Dubai";
        }
        if (el('emirateDropdown')) el('emirateDropdown').value = placeOfSupply;
        
        if (el('vatTreatmentDropdown')) {
          // Normalize invoice-provided VAT treatment values coming from invoice rows
          const raw = inv["VAT Treatement"] || inv["VAT Treatment"] || '';
          if (typeof window.normalizeVatTreatment === 'function') {
            el('vatTreatmentDropdown').value = window.normalizeVatTreatment(raw);
          } else {
            el('vatTreatmentDropdown').value = raw || '';
          }
        }
        
        // Set Invoice Status - default to "Sent" if not specified
        let invoiceStatus = inv["Invoice Status"] || "Sent";
        // Keep the invoice status value as-is (support 'Closed' explicitly)
        // Do not remap 'Closed' to 'Paid' — the dropdown value now supports 'Closed'
        if (el('invoiceStatusDropdown')) {
          el('invoiceStatusDropdown').value = invoiceStatus;
          // When viewing an existing invoice ensure Closed is selectable
          if (typeof window.setInvoiceStatusClosedAllowed === 'function') window.setInvoiceStatusClosedAllowed(true);
        }
        
        if (el('projectCodeInput')) el('projectCodeInput').value = inv["Project Code"] || "";
        if (el('projectCode')) el('projectCode').value = inv["Project Code"] || "";
        if (el('projectCodeDisplay')) el('projectCodeDisplay').textContent = inv["Project Code"] || "";
        if (el('notesText')) el('notesText').value = inv["Notes"] || "";

        const customerName = inv["Customer Name"] || "";
        if (el('clientNameDisplay')) el('clientNameDisplay').textContent = customerName;

        // Auto-select client if present
        if (Array.isArray(window.clientsData) && window.clientsData.length > 0 && customerName) {
            const clientDropdown = el('clientDropdown');
            if (clientDropdown) {
                const matchIndex = window.clientsData.findIndex(client => {
                  const n = client['Display Name'] || client['Client Name'] || client['Name'] || client['name'] || client['CLIENT NAME'] || client['client_name'] || "";
                    return n.toLowerCase() === customerName.toLowerCase();
                });
                if (matchIndex >= 0) {
                    clientDropdown.value = String(matchIndex);
                    const sel = window.clientsData[matchIndex];
                if (typeof window.highlightAutoSelection === 'function') window.highlightAutoSelection(clientDropdown, `Auto-selected: ${sel['Display Name'] || sel['Client Name'] || sel['Name'] || ''}`);
                }
            }
        }

        // Build address and TRN
        let clientAddress = "";
        let clientTRN = "";
        let selectedClient = null;
        if (Array.isArray(window.clientsData) && window.clientsData.length > 0 && customerName) {
            const mi = window.clientsData.findIndex(c => (c['Display Name'] || c['Client Name'] || c['Name'] || c['name'] || '').toLowerCase() === customerName.toLowerCase());
            if (mi >= 0) selectedClient = window.clientsData[mi];
        }
        if (selectedClient) {
            const adr1 = selectedClient['Billing Address'] || selectedClient['Address Line 1'] || selectedClient['address_line_1'] || selectedClient['Address1'] || "";
            const adr2 = selectedClient['Billing Address 2'] || selectedClient['Address Line 2'] || selectedClient['address_line_2'] || selectedClient['Address2'] || "";
            const city = selectedClient['City'] || selectedClient['city'] || "";
            const country = selectedClient['Country'] || selectedClient['country'] || "";
            if (adr1) clientAddress += adr1;
            if (adr2) clientAddress += (clientAddress ? '<br>' : '') + adr2;
            if (city) clientAddress += (clientAddress ? '<br>' : '') + city;
            // Keep country out of the main address block — show separately in clientCountryDisplay
            clientTRN = selectedClient['Tax Registration Number'] || selectedClient['TRN Number'] || selectedClient['TRN'] || selectedClient['trn_number'] || selectedClient['trn'] || "";

            // Show Billing Country separately if provided
            const billingCountry = selectedClient['Billing Country'] || selectedClient['Country'] || selectedClient['billing_country'] || '';
            const ccEl = el('clientCountryDisplay');
            if (ccEl) {
              ccEl.textContent = billingCountry || '';
              ccEl.style.display = billingCountry ? 'block' : 'none';
            }

            // VAT Treatment: prefer an explicit value from the contacts row if present
            const vatFromContact = selectedClient['VAT Treatment'] || selectedClient['VAT Treatement'] || selectedClient['VAT Status'] || selectedClient['Vat Treatment'] || "";
            if (el('vatTreatmentDropdown')) {
              if (vatFromContact && String(vatFromContact).trim() !== '') {
                // Normalize then set
                el('vatTreatmentDropdown').value = (typeof window.normalizeVatTreatment === 'function') ? window.normalizeVatTreatment(vatFromContact) : vatFromContact;
                el('vatTreatmentDropdown').disabled = false;
              } else if (clientTRN && clientTRN.trim() !== "") {
                el('vatTreatmentDropdown').value = "Vat Registered";
                el('vatTreatmentDropdown').disabled = false;
              } else {
                el('vatTreatmentDropdown').value = "Vat Not Registered";
                el('vatTreatmentDropdown').disabled = false;
              }
            }
        } else {
          // Try multiple invoice fields for billing/address data
          const pick = (keys) => {
            for (const k of keys) {
              if (inv.hasOwnProperty(k) && inv[k] !== undefined && String(inv[k]).trim() !== "") return String(inv[k]);
            }
            return "";
          };

          // Prefer a single combined field if present
          const combined = pick(["Client Address", "Billing Address", "Billing Street", "Billing Street1", "Billing Street 1"]);
          // Ensure `country` is always defined (combined branch didn't set it)
          let country = "";
          if (combined) {
            clientAddress = combined.replace(/\n/g, "<br>");
          } else {
            // Otherwise assemble from parts
            const street1 = pick(["Billing Street", "Billing Street1", "Billing Address Line1", "Billing Address1", "Address Line 1"]);
            const street2 = pick(["Billing Street2", "Billing Address Line2", "Billing Address2", "Address Line 2"]);
            const city = pick(["Billing City", "Client City", "City"]);
            const state = pick(["Billing State", "Client State", "State"]);
            country = pick(["Billing Country", "Client Country", "Country"]);
            const postal = pick(["Billing Code", "Billing Postal", "Billing Zip", "Postal Code", "Billing Postal Code"]);

            const parts = [];
            if (street1) parts.push(street1);
            if (street2) parts.push(street2);
            if (city) parts.push(city);
            if (state) parts.push(state);
            // Do not append country into the main address block here.
            // Billing country will be shown separately in clientCountryDisplay.
            if (postal) parts.push(postal);
            clientAddress = parts.join('<br>');
          }

          clientTRN = pick(["Client TRN", "Billing TRN", "Tax Registration Number", "TRN", "Client TRN Number"]);

          // Ensure country is displayed separately when building from invoice row fields
          const ccEl = el('clientCountryDisplay');
          if (ccEl) {
            ccEl.textContent = country || '';
            ccEl.style.display = country ? 'block' : 'none';
          }
        }

        if (el('clientAddressDisplay')) el('clientAddressDisplay').innerHTML = clientAddress;
        if (el('clientTRNDisplay')) el('clientTRNDisplay').textContent = clientTRN ? ("TRN " + clientTRN) : "";

        // Render items
        const tbody = document.getElementById('itemsTable');
        if (tbody) tbody.innerHTML = "";
        items.forEach((item, i) => {
            if (!tbody) return;
            const tr = document.createElement('tr');
            tr.innerHTML = `
      <td>${i + 1}</td>
      <td>
        <textarea class="desc-input">${item["Item Desc"] || ""}</textarea>
        <span class="value-for-print" style="display:none"></span>
      </td>
      <td>
        <input type="number" class="qty-input" value="${sanitizeNumericForInput(item["Quantity"] || 1)}" step="0.01">
        <span class="value-for-print" style="display:none"></span>
      </td>
      <td>
        <input type="number" class="rate-input" value="${sanitizeNumericForInput(item["Item Price"] || 0)}" step="0.01">
        <span class="value-for-print" style="display:none"></span>
      </td>
      <td>
        <input type="number" class="discount-input" value="${sanitizeNumericForInput(item["Discount Amount"] || item["Discount"] || 0)}" step="0.01">
        <span class="value-for-print" style="display:none"></span>
      </td>
      <td class="taxable-amount">
        <span class="value-for-screen">0.00</span>
        <span class="value-for-print" style="display:none">0.00</span>
      </td>
      <td class="tax-amount">
        <span class="value-for-screen">0.00</span>
        <span class="value-for-print" style="display:none">0.00</span>
      </td>
      <td>
        <select class="tax-percent-input">
          <option value="5"${item["Item Tax %"] == "5" ? " selected" : ""}>5</option>
          <option value="0"${item["Item Tax %"] == "0" ? " selected" : ""}>0</option>
          <option value="-"${item["Item Tax %"] == "-" ? " selected" : ""}>-</option>
        </select>
        <span class="value-for-print" style="display:none"></span>
      </td>
      <td class="line-total">
        <span class="value-for-screen">0.00</span>
        <span class="value-for-print" style="display:none">0.00</span>
      </td>
      <td class="editable-hide">
        <button class="remove-btn" onclick="removeRow(this)">×</button>
      </td>
    `;
            tbody.appendChild(tr);
            if (typeof window.attachListeners === 'function') window.attachListeners(tr);
        });

        // Calculate totals and update nav
        calculateTotals();
        if (typeof window.updateInvoiceNavButtons === 'function') window.updateInvoiceNavButtons();
        
        // Update all display fields (including parsing DU -> Dubai, setting default status)
        updateInvoiceDisplayFields();
        
        // Update button state (Clone vs Save)
        if (typeof window.checkSaveButtonState === 'function') window.checkSaveButtonState();
        
        console.log(`Invoice ${invoiceNo} loaded successfully from table data`);
    }

    /**
     * Control whether the 'Closed' option should be allowed in the invoice status dropdown
     * When creating or cloning a new invoice we disable the Closed option; when viewing existing invoices we enable it.
     */
    function setInvoiceStatusClosedAllowed(allow) {
      const s = document.getElementById('invoiceStatusDropdown');
      if (!s) return;
      try {
        const opt = Array.from(s.options).find(o => (o.value || '').toString().trim() === 'Closed');
        if (opt) {
          opt.disabled = !allow;
          // Adjust title for clarity
          opt.title = allow ? 'Closed invoices can be selected' : 'Closed cannot be selected for new or cloned invoices';
        }
      } catch (e) { console.warn('setInvoiceStatusClosedAllowed error', e); }
    }

    // Expose
    window.invoiceRenderer = {
        showInvoice,
        clearInvoiceDisplay,
        calculateTotals,
        updateInvoiceDisplayFields
    };

    // Also expose as top-level for backwards compatibility
    window.showInvoice = window.invoiceRenderer.showInvoice;
    window.clearInvoiceDisplay = window.invoiceRenderer.clearInvoiceDisplay;
    window.calculateTotals = window.invoiceRenderer.calculateTotals;
    window.updateInvoiceDisplayFields = window.invoiceRenderer.updateInvoiceDisplayFields;

})();
