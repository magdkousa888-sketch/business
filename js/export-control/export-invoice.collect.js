(function () {
    window.ExportInvoice = window.ExportInvoice || {};

    window.ExportInvoice.collectInvoiceDataFromPage = function () {
        const pick = (id) => {
            const el = window.ExportInvoice.getVisibleElById(id);
            if (!el) return null;
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return el.value;
            return el.innerHTML || el.textContent || null;
        };
        const data = {
            invoiceNumber: pick('invoiceNumber'),
            clientName: pick('clientNameDisplay'),
            clientAddress: pick('clientAddressDisplay'),
            clientCountry: pick('clientCountryDisplay'),
            clientTRN: pick('clientTRNDisplay'),
            invoiceDate: pick('invoiceDate'),
            terms: pick('terms'),
            dueDate: pick('dueDate'),
            projectCode: pick('projectCode'),
            subtotal: pick('subtotal'),
            totalTax: pick('totalTax'),
            grandTotal: pick('grandTotal'),
            balanceDue: pick('balanceDue'),
            remainingBalance: pick('remainingBalance'),
            notes: pick('notesText')
        };
        const visibleItemsTable = Array.from(document.querySelectorAll('#itemsTable')).find(el => (el.offsetParent !== null) || (el.getClientRects && el.getClientRects().length > 0));
        data.itemsHtml = visibleItemsTable ? visibleItemsTable.innerHTML : document.getElementById('itemsTable') ? document.getElementById('itemsTable').innerHTML : null;
        return data;
    };
})();
