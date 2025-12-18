(function(){
  'use strict';

  // Small right-click context menu for invoice actions
  // - Edit invoice -> window.openInvoicePreviewForUpdate(inv)
  // - Delete invoice -> window.openDeleteModal()
  // - Add a bundle -> window.openAddBundleModal()
  // - Refresh -> window.dataLoader.loadFromGoogleSheets(...) or window.loadFromGoogleSheets()

  function createStyle() {
    const css = `
      .rc-menu { position: fixed; background: var(--bg-surface, #fff); color: var(--text, #111); box-shadow: 0 6px 18px rgba(15,23,42,0.12); border-radius: 6px; padding: 6px; z-index: 10050; min-width: 180px; font-size: 13px; }
      .rc-menu:focus { outline: none; }
      .rc-menu .rc-btn { display:block; width:100%; text-align:left; border: none; background: transparent; padding: 8px 10px; cursor: pointer; border-radius: 4px; }
      .rc-menu .rc-btn:hover { background: rgba(0,0,0,0.04); }
      .rc-menu .rc-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .rc-menu .rc-sep { height: 1px; background: #eee; margin: 6px 0; }
    `;
    const st = document.createElement('style'); st.type = 'text/css'; st.appendChild(document.createTextNode(css));
    document.head.appendChild(st);
  }

  function buildMenu(invNumber) {
    // Remove any existing menu
    removeMenu();

    const menu = document.createElement('div');
    menu.id = 'rcMenu';
    menu.className = 'rc-menu';
    menu.setAttribute('role', 'menu');
    menu.tabIndex = -1;

    // Buttons
    const btnNew = document.createElement('button'); btnNew.className = 'rc-btn'; btnNew.type = 'button'; btnNew.dataset.action = 'new'; btnNew.textContent = 'New invoice';
    const btnEdit = document.createElement('button'); btnEdit.className = 'rc-btn'; btnEdit.type = 'button'; btnEdit.dataset.action = 'edit'; btnEdit.textContent = 'Edit invoice';
    const btnClone = document.createElement('button'); btnClone.className = 'rc-btn'; btnClone.type = 'button'; btnClone.dataset.action = 'clone'; btnClone.textContent = 'Clone invoice';
    const btnRecord = document.createElement('button'); btnRecord.className = 'rc-btn'; btnRecord.type = 'button'; btnRecord.dataset.action = 'record'; btnRecord.textContent = 'Record payment';
    const btnDelete = document.createElement('button'); btnDelete.className = 'rc-btn'; btnDelete.type = 'button'; btnDelete.dataset.action = 'delete'; btnDelete.textContent = 'Delete invoice';
    const sep = document.createElement('div'); sep.className = 'rc-sep';
    const btnBundle = document.createElement('button'); btnBundle.className = 'rc-btn'; btnBundle.type = 'button'; btnBundle.dataset.action = 'bundle'; btnBundle.textContent = 'Add a bundle';
    const btnRefresh = document.createElement('button'); btnRefresh.className = 'rc-btn'; btnRefresh.type = 'button'; btnRefresh.dataset.action = 'refresh'; btnRefresh.textContent = 'Refresh';

    // Disable actions that require a selected invoice when no invoice number is present
    if (!invNumber) {
      btnEdit.disabled = true;
      btnClone.disabled = true;
      btnRecord.disabled = true;
      btnDelete.disabled = true;
      btnEdit.title = 'No invoice selected';
      btnClone.title = 'No invoice selected';
      btnRecord.title = 'No invoice selected';
      btnDelete.title = 'No invoice selected';
    }

    // Append (group related actions together)
    menu.appendChild(btnNew);
    menu.appendChild(btnEdit);
    menu.appendChild(btnClone);
    menu.appendChild(btnRecord);
    menu.appendChild(btnDelete);
    menu.appendChild(sep);
    menu.appendChild(btnBundle);
    menu.appendChild(btnRefresh);

    // Action handler
    menu.addEventListener('click', function(e){
      const act = e.target && e.target.dataset && e.target.dataset.action;
      if (!act) return;
      try {
        const inv = (document.getElementById('invoiceNumber') && document.getElementById('invoiceNumber').value) || '';
        if (act === 'edit') {
          if (!inv) {
            if (typeof window.showToast === 'function') window.showToast('No invoice selected', 'warning', 3000);
            return;
          }
          if (typeof window.openInvoicePreviewForUpdate === 'function') {
            window.openInvoicePreviewForUpdate(inv);
          } else if (typeof window.openInvoicePreviewModal === 'function') {
            window.openInvoicePreviewModal(inv, { allowUpdate: true });
          } else {
            if (typeof window.showToast === 'function') window.showToast('Preview function not available', 'warning', 3000);
          }
        } else if (act === 'new') {
          // Create a new invoice
          if (typeof window.addNewInvoice === 'function') {
            try { window.addNewInvoice(); } catch (e) { console.warn('addNewInvoice failed', e); if (typeof window.showToast === 'function') window.showToast('Failed to create new invoice', 'warning', 3000); }
          } else if (typeof window.addNewInvoiceImpl === 'function') {
            try { window.addNewInvoiceImpl(); } catch (e) { console.warn('addNewInvoiceImpl failed', e); if (typeof window.showToast === 'function') window.showToast('Failed to create new invoice', 'warning', 3000); }
          } else {
            if (typeof window.showToast === 'function') window.showToast('New invoice function not available', 'warning', 3000);
          }
        } else if (act === 'clone') {
          // Clone the current invoice (uses the form state)
          if (!inv) {
            if (typeof window.showToast === 'function') window.showToast('No invoice selected to clone', 'warning', 3000);
            return;
          }
          if (typeof window.cloneCurrentInvoice === 'function') {
            window.cloneCurrentInvoice();
          } else if (window.invoiceClone && typeof window.invoiceClone.cloneCurrentInvoice === 'function') {
            window.invoiceClone.cloneCurrentInvoice();
          } else {
            if (typeof window.showToast === 'function') window.showToast('Clone not available', 'warning', 3000);
          }
        } else if (act === 'record') {
          if (!inv) {
            if (typeof window.showToast === 'function') window.showToast('No invoice selected for payment', 'warning', 3000);
            return;
          }
          if (typeof window.RecordPayment === 'function') {
            window.RecordPayment();
          } else if (typeof window.recordPayment === 'function') {
            window.recordPayment();
          } else {
            if (typeof window.showToast === 'function') window.showToast('Record payment not available', 'warning', 3000);
          }
        } else if (act === 'delete') {
          if (typeof window.openDeleteModal === 'function') {
            window.openDeleteModal();
          } else {
            if (typeof window.showToast === 'function') window.showToast('Delete modal not available', 'warning', 3000);
          }
        } else if (act === 'bundle') {
          if (typeof window.openAddBundleModal === 'function') {
            window.openAddBundleModal();
          } else {
            if (typeof window.showToast === 'function') window.showToast('Bundle manager not available', 'warning', 3000);
          }
        } else if (act === 'refresh') {
          // Prefer dataLoader with status element if available
          try {
            if (window.dataLoader && typeof window.dataLoader.loadFromGoogleSheets === 'function') {
              window.dataLoader.loadFromGoogleSheets(document.getElementById('sheetsLoadStatus'));
            } else if (typeof window.loadFromGoogleSheets === 'function') {
              window.loadFromGoogleSheets(document.getElementById('sheetsLoadStatus'));
            } else if (typeof window.showToast === 'function') {
              window.showToast('Reload function not available', 'info', 3000);
            }
          } catch (err) {
            console.warn('Reload failed', err);
            if (typeof window.showToast === 'function') window.showToast('Reload failed', 'warning', 3000);
          }
        }
      } finally {
        removeMenu();
      }
    });

    // Close on blur / escape / click outside
    menu.addEventListener('keydown', function(e){ if (e.key === 'Escape') removeMenu(); });

    document.body.appendChild(menu);
    setTimeout(()=>menu.focus(), 0);
    return menu;
  }

  function removeMenu() {
    const m = document.getElementById('rcMenu'); if (m) m.remove();
  }

  function showMenuAt(menu, x, y) {
    if (!menu) return;
    const pad = 8;
    const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);

    // default position
    let left = x + pad;
    let top = y + pad;

    // ensure fit horizontally
    const rectW = menu.offsetWidth || 200;
    const rectH = menu.offsetHeight || 140;
    if ((left + rectW) > vw) left = Math.max(8, x - rectW - pad);
    if ((top + rectH) > vh) top = Math.max(8, y - rectH - pad);

    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
  }

  // Initialization
  document.addEventListener('DOMContentLoaded', function(){
    createStyle();

    document.addEventListener('contextmenu', function(ev){
      try {
        const target = ev.target;
        // Only show on right-click inside the invoice wrapper (or invoice-number input)
        if (!target) return;
        // Allow context menu when user right-clicks anywhere inside the main invoice area
        const invoiceWrap = target.closest('.invoice-wrapper') || target.closest('.invoice-number') || (target.id === 'invoiceNumber' ? target : null);
        if (!invoiceWrap) return; // let browser context menu appear for other elements

        ev.preventDefault();
        ev.stopPropagation();

        const inv = (document.getElementById('invoiceNumber') && document.getElementById('invoiceNumber').value) || '';
        const menu = buildMenu(inv);
        // Position menu at mouse
        showMenuAt(menu, ev.pageX, ev.pageY);

        // Close on any click outside
        const onDocClick = function(e){ if (!e.target.closest || !e.target.closest('#rcMenu')) removeMenu(); };
        const onScrollOrResize = function(){ removeMenu(); };

        setTimeout(()=>{
          document.addEventListener('click', onDocClick, { once: true });
          window.addEventListener('scroll', onScrollOrResize, { once: true });
          window.addEventListener('resize', onScrollOrResize, { once: true });
        }, 0);

      } catch (e) {
        console.warn('context menu error', e);
      }
    });

    // Also close if user presses Escape anywhere
    document.addEventListener('keydown', function(e){ if (e.key === 'Escape') removeMenu(); });
  });

})();
