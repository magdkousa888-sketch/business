(function () {
    window.ExportInvoice = window.ExportInvoice || {};

    window.ExportInvoice.populateExportWrapper = function (wrapperEl, data) {
        if (!wrapperEl || !data) return;
        const setVal = (selector, value) => {
            if (value == null) return;
            const el = wrapperEl.querySelector(selector);
            if (!el) return;
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') el.value = value;
            else el.innerHTML = value;
        };
        setVal('#invoiceNumber', data.invoiceNumber);
        setVal('#clientNameDisplay', data.clientName);
        setVal('#clientAddressDisplay', data.clientAddress);
        setVal('#clientCountryDisplay', data.clientCountry);
        setVal('#clientTRNDisplay', data.clientTRN);
        setVal('#invoiceDate', data.invoiceDate);
        setVal('#terms', data.terms);
        setVal('#dueDate', data.dueDate);
        setVal('#projectCode', data.projectCode);
        setVal('#subtotal', data.subtotal);
        setVal('#totalTax', data.totalTax);
        setVal('#grandTotal', data.grandTotal);
        setVal('#balanceDue', data.balanceDue);
        setVal('#remainingBalance', data.remainingBalance);
        setVal('#notesText', data.notes);
        if (data.itemsHtml) {
            const tbody = wrapperEl.querySelector('#itemsTable');
            if (tbody) tbody.innerHTML = data.itemsHtml;
        }

        // Replace form controls with printable spans
        const formControls = Array.from(wrapperEl.querySelectorAll('input, textarea, select'));
        let replaced = 0;
        formControls.forEach(ctrl => {
            try {
                const tag = ctrl.tagName;
                let val = '';
                if (tag === 'INPUT' || tag === 'TEXTAREA') val = ctrl.value;
                else if (tag === 'SELECT') val = ctrl.options && ctrl.options[ctrl.selectedIndex] ? ctrl.options[ctrl.selectedIndex].text : '';
                const cell = ctrl.closest('td') || ctrl.parentNode;
                if (!cell) {
                    const span = document.createElement('span'); span.className = 'value-for-print'; span.textContent = val;
                    if (ctrl.parentNode) ctrl.parentNode.replaceChild(span, ctrl);
                    replaced++;
                    return;
                }
                const existing = cell.querySelector('.value-for-print');
                if (existing) {
                    existing.textContent = val;
                    if (ctrl.parentNode) ctrl.parentNode.removeChild(ctrl);
                } else {
                    const span = document.createElement('span');
                    span.className = 'value-for-print';
                    if (ctrl.id === 'notesText' || (ctrl.classList && ctrl.classList.contains && ctrl.classList.contains('export-notes-textarea'))) span.classList.add('export-notes-textarea');
                    span.textContent = val;
                    if (ctrl.parentNode) ctrl.parentNode.replaceChild(span, ctrl);
                }
                replaced++;
            } catch (e) { /* ignore */ }
        });

        // clean duplicate nodes
        let cleaned = 0;
        const cells = Array.from(wrapperEl.querySelectorAll('td'));
        const numericCols = new Set([3,4,5,6,7,8,9]);
        cells.forEach(td => {
            const v = td.querySelector('.value-for-print');
            if (!v) return;
            const keepText = (v.textContent || '').trim();
            Array.from(td.childNodes).forEach(node => {
                if (node === v) return;
                if (node.nodeType === Node.TEXT_NODE) {
                    const txt = node.textContent.trim();
                    if (!txt || txt === keepText) { td.removeChild(node); cleaned++; }
                    else if (numericCols.has((td.cellIndex||0)+1) && /^[0-9.,\s]+$/.test(txt)) { td.removeChild(node); cleaned++; }
                } else if (node.nodeType === Node.ELEMENT_NODE && !node.classList.contains('value-for-print')) {
                    const txt = (node.textContent || '').trim();
                    if (txt === keepText) { td.removeChild(node); cleaned++; }
                    else if (numericCols.has((td.cellIndex||0)+1) && /^[0-9.,\s]+$/.test(txt)) { td.removeChild(node); cleaned++; }
                }
            });
        });

        // remove edit-only
        const toRemove = Array.from(wrapperEl.querySelectorAll('.editable-hide'));
        toRemove.forEach(el => { if (el && el.parentNode) el.parentNode.removeChild(el); });

        // Insert totals row
        const tbody = wrapperEl.querySelector('#itemsTable');
        if (tbody) {
            const existing = tbody.querySelectorAll('.items-table-total-row');
            existing.forEach(e => e.parentNode && e.parentNode.removeChild(e));

            const parseNumber = (str) => {
                if (str == null) return 0;
                str = ('' + str).trim();
                if (typeof str === 'string' && str.indexOf('data-print-value') > -1) {
                    const m = /data-print-value="([^"]+)"/.exec(str);
                    if (m) str = m[1];
                }
                const cleaned = ('' + str).replace(/[^0-9.\-]/g, '');
                const n = parseFloat(cleaned);
                return isNaN(n) ? 0 : n;
            };

            let taxableSum = 0, taxSum = 0, totalSum = 0;
            Array.from(tbody.querySelectorAll('tr')).forEach(row => {
                const cells = row.querySelectorAll('td');
                if (!cells || cells.length < 9) return;
                try {
                    const taxableCell = row.querySelector('td:nth-child(6)');
                    const taxCell = row.querySelector('td:nth-child(7)');
                    const totalCell = row.querySelector('td:nth-child(9)');
                    if (taxableCell) taxableSum += parseNumber(taxableCell.textContent || taxableCell.getAttribute('data-print-value') || '0');
                    if (taxCell) taxSum += parseNumber(taxCell.textContent || taxCell.getAttribute('data-print-value') || '0');
                    if (totalCell) totalSum += parseNumber(totalCell.textContent || totalCell.getAttribute('data-print-value') || '0');
                } catch (e) { /* ignore */ }
            });

            const formatNumber = window.formatNumber || ((n) => (typeof n === 'number' ? n.toFixed(2) : n));

            const totalRow = document.createElement('tr');
            totalRow.className = 'items-table-total-row';
            totalRow.innerHTML = `
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td >Sub Total</td>
                <td class="totals-value" id="export-taxable-sum">${formatNumber(taxableSum)}</td>
                <td class="totals-value" id="export-tax-sum">${formatNumber(taxSum)}</td>
                <td></td>
                <td class="totals-value" id="export-total-sum">${formatNumber(totalSum)}</td>
            `;
            tbody.appendChild(totalRow);
        }
    };
})();
