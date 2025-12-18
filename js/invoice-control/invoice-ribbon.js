/* invoice-ribbon.js — keep the on-screen ribbon synced with invoice status */
(function(){
  'use strict';

  function normalizeStatusForClass(s){
    if (!s && s !== 0) return 'none';
    return String(s).trim().toLowerCase().replace(/\s+/g,'-');
  }

  function updateInvoiceRibbon(status){
    try {
      const ribbon = document.getElementById('invoiceRibbon');
      const inner = document.getElementById('invoiceRibbonInner');
      if (!inner || !ribbon) return;
      // If there is no invoice rendered from Google Sheets, show the neutral 'none' ribbon
      const invEl = document.getElementById('invoiceNumber');
      const clientEl = document.getElementById('clientNameDisplay');
      const itemsTbl = document.getElementById('itemsTable');
      const noInvoice = (invEl && String(invEl.value || '').trim() === '') || (clientEl && (String(clientEl.textContent || '').toLowerCase().indexOf('no invoices') !== -1)) || (itemsTbl && itemsTbl.querySelectorAll('tr').length === 0);
      if (noInvoice) {
        inner.textContent = '';
        inner.className = 'ribbon-inner ribbon-none';
        ribbon.hidden = false;
        return;
      }
      const raw = (status || '').toString();
      const norm = normalizeStatusForClass(raw);
      // Mapping rules: Closed -> Paid (green), Sent -> Sent (orange), others use status name
      let display = raw;
      let cls = norm;
      if (norm === 'closed') { display = 'Paid'; cls = 'paid'; }
      else if (norm === 'sent') { display = 'Sent'; cls = 'sent'; }
      else if (norm === 'overdue') { display = 'Overdue'; cls = 'overdue'; }
      inner.textContent = display;
      inner.className = 'ribbon-inner ribbon-' + cls;
      ribbon.hidden = false;
    } catch (e) { /* noop */ }
  }

  // Expose for external calls / tests
  window.updateInvoiceRibbon = updateInvoiceRibbon;

  function attachListeners(){
    const statusEl = document.getElementById('invoiceStatusDropdown');
    if (statusEl) {
      statusEl.addEventListener('change', function(){ updateInvoiceRibbon(this.value); });
    }

    // Wrap showInvoice so ribbon is updated when invoices are loaded programmatically
    if (typeof window.showInvoice === 'function'){
      const orig = window.showInvoice;
      window.showInvoice = function(){
        const res = orig.apply(this, arguments);
        try {
          const s = (document.getElementById('invoiceStatusDropdown') && document.getElementById('invoiceStatusDropdown').value) || document.getElementById('invoiceRibbonInner') && document.getElementById('invoiceRibbonInner').textContent || 'Draft';
          updateInvoiceRibbon(s);
        } catch(e){}
        return res;
      };
    }

    // Initial sync
    const initial = (document.getElementById('invoiceStatusDropdown') && document.getElementById('invoiceStatusDropdown').value) || 'Draft';
    updateInvoiceRibbon(initial);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attachListeners); else attachListeners();
})();
