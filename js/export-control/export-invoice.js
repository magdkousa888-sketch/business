document.addEventListener('DOMContentLoaded', function () {
    // render preview template into test container if present
    if (window.ExportInvoice && window.ExportInvoice.loadTemplateInto) window.ExportInvoice.loadTemplateInto('test-invoice');

    const exportBtn = document.getElementById('exportInvoiceBtn');
    if (!exportBtn) {
        console.warn('exportInvoiceBtn not found - export button listener not attached.');
        return;
    }

    exportBtn.addEventListener('click', async function () {
        try {
            if (!window.ExportInvoice || !window.ExportInvoice.collectInvoiceDataFromPage || !window.ExportInvoice.exportFromData) {
                console.error('ExportInvoice modules not loaded');
                return;
            }
            const pageData = window.ExportInvoice.collectInvoiceDataFromPage();
            await window.ExportInvoice.exportFromData(pageData);
        } catch (e) {
            console.error('Export failed:', e);
        }
    });
});
