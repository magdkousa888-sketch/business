// UI helper functions extracted from Invoices Control Panel.htm
(function(){
  'use strict';

  function toggleDataSource() {
    const csvSelected = document.getElementById('dataSourceCSV') && document.getElementById('dataSourceCSV').checked;
    const csvSection = document.getElementById('csvUploadSection');
    const sheetsSection = document.getElementById('googleSheetsSection');
    if (!csvSection || !sheetsSection) return;
    if (csvSelected) {
      csvSection.style.display = 'block';
      sheetsSection.style.display = 'none';
    } else {
      csvSection.style.display = 'none';
      sheetsSection.style.display = 'block';
    }
  }

  // expose to window
  window.toggleDataSource = toggleDataSource;

  // --- Side toolbar interactions (non-intrusive) ---
  function toolbarAction(action) {
    try {
      if (!action) return;
      switch(action) {
        case 'home':
          if (window.navigation && typeof window.navigation.goToLastInvoice === 'function') {
            window.navigation.goToLastInvoice();
          }
          break;
        case 'loadData':
          if (typeof window.loadFromGoogleSheets === 'function') {
            try { window.loadFromGoogleSheets(document.getElementById('sheetsLoadStatus')); } catch(e){ window.loadFromGoogleSheets(); }
          } else if (window.dataLoader && typeof window.dataLoader.loadFromGoogleSheets === 'function') {
            window.dataLoader.loadFromGoogleSheets(document.getElementById('sheetsLoadStatus'));
          } else {
            alert('Load from Google Sheets not available');
          }
          break;
        case 'reports':
          // Prefer the in-app reports modal (replace download behavior) — fallback to existing export if modal not available
          if (typeof window.showReports === 'function') {
            try { window.showReports(); } catch(e){ console.warn('showReports threw', e); if (typeof window.exportZohoCSV === 'function') window.exportZohoCSV(); }
          } else if (typeof window.exportZohoCSV === 'function') {
            window.exportZohoCSV();
          } else {
            alert('Reports not implemented yet');
          }
          break;
        case 'settings':
          if (typeof window.openSettings === 'function') window.openSettings(); else alert('Settings not implemented yet');
          break;
        // 'updateInvoice' action removed — updates are only allowed via the Invoice Preview modal
        case 'previewInvoice':
          if (typeof window.previewCurrentInvoice === 'function') {
            try { window.previewCurrentInvoice(); } catch(e) { alert('Preview failed: ' + (e && e.message ? e.message : e)); }
          } else if (typeof window.openInvoicePreviewModal === 'function') {
            try { window.openInvoicePreviewModal((document.getElementById('invoiceNumber') && document.getElementById('invoiceNumber').value) || ''); } catch(e) { alert('Preview failed: ' + (e && e.message ? e.message : e)); }
          } else {
            alert('Preview not available in this environment');
          }
          break;
        case 'addClient':
          // open manual add-client modal if handler exists
          if (typeof window.openManualClientPopup === 'function') {
            window.openManualClientPopup();
          } else if (typeof window.openManualClient === 'function') {
            window.openManualClient();
          } else {
            alert('Add client not implemented');
          }
          break;
        case 'addBundle':
          if (typeof window.openAddBundleModal === 'function') {
            window.openAddBundleModal();
          } else {
            alert('Add bundle not implemented');
          }
          break;
        case 'expensesManager':
          if (typeof window.openExpensesManager === 'function') {
            try { window.openExpensesManager(); } catch(e){ console.warn('openExpensesManager threw', e); alert('Expenses Manager failed: ' + (e && e.message ? e.message : e)); }
          } else {
            alert('Expenses Manager not available');
          }
          break;
        default: console.log('toolbar unknown', action);
      }
    } catch(err) { console.error('toolbar action error', err); }
  }

  function initSideToolbar(){
    const toolbar = document.getElementById('sideToolbar');
    if (!toolbar) return;
    // start collapsed by default
    toolbar.classList.add('collapsed');
    // make sure toggle icon reflects collapsed state (chevron points right)
    const initIcon = document.getElementById('toolbarToggleIcon');
    const initToggle = document.getElementById('toolbarToggle');
    if (initIcon) initIcon.style.transform = 'rotate(180deg)';
    if (initToggle) initToggle.setAttribute('aria-expanded', 'false');

    toolbar.addEventListener('click', (e) => {
      const btn = e.target.closest('.toolbar-btn');
      if (btn && btn.dataset && btn.dataset.action) toolbarAction(btn.dataset.action);
    });

    // If data already loaded during this session, show the small loaded indicator on the toolbar.
    try {
      const loadBtn = toolbar.querySelector('.toolbar-btn[data-action="loadData"]');
      if (loadBtn && (window.csvFileUploaded || window.invoiceFileUploaded)) loadBtn.classList.add('loaded');
    } catch(e) { /* noop */ }

    const toggle = document.getElementById('toolbarToggle');
    if (toggle) {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const expanded = toolbar.classList.toggle('expanded');
        if (expanded) {
          toolbar.classList.remove('collapsed');
          toolbar.classList.add('expanded');
          toolbar.setAttribute('aria-hidden', 'false');
        } else {
          toolbar.classList.add('collapsed');
          toolbar.classList.remove('expanded');
          toolbar.setAttribute('aria-hidden', 'true');
        }
        // rotate the svg icon
        const icon = document.getElementById('toolbarToggleIcon');
        if (icon) icon.style.transform = expanded ? 'rotate(180deg)' : 'rotate(0deg)';
        toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      });
    }
  }

  // Show a guide image from the 'guide' folder in a modal. Defaults to 'guide/guide.jpg'
  function showGuideImage(imagePath) {
    const path = imagePath || 'guide/guide.jpg';
    try {
      // Prevent multiple instances
      if (document.getElementById('guideModalOverlay')) return;

      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay small-modal';
      overlay.id = 'guideModalOverlay';

      overlay.innerHTML = `
        <div class="guide-modal-content" role="dialog" aria-modal="true" aria-label="Guide Image">
          <div class="modal-header">
            <h3>Guide</h3>
            <button id="guideModalClose" class="modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <div id="guideImageWrapper" class="guide-image-wrapper">
              <div id="guideLoader" class="guide-loader">
                <div class="guide-spinner"></div>
                <div class="guide-loading-text">Loading image…</div>
              </div>
            </div>
          </div>
        </div>
      `;

      // Close handlers
      function closeGuideModal() {
        const ov = document.getElementById('guideModalOverlay');
        if (ov) ov.remove();
        document.body.style.overflow = '';
        document.removeEventListener('keydown', onKeyDown);
      }

      function onKeyDown(e) { if (e.key === 'Escape') closeGuideModal(); }

      overlay.addEventListener('click', function(e){
        if (e.target === overlay) closeGuideModal();
      });

      // Attach and wire close button
      document.body.appendChild(overlay);
      document.body.style.overflow = 'hidden';
      document.getElementById('guideModalClose')?.addEventListener('click', closeGuideModal);
      document.addEventListener('keydown', onKeyDown);

      // Start preloading the image and replace the loader when ready
      try {

        const wrapper = document.getElementById('guideImageWrapper');
        const pre = new Image();
        pre.onload = function() {
          try {
            // Replace loader with the actual image
            const imgEl = document.createElement('img');
            imgEl.id = 'guideModalImg';
            imgEl.className = 'guide-image';
            imgEl.src = path;
            imgEl.alt = 'Guide';

            if (wrapper) {
              wrapper.innerHTML = '';
              wrapper.appendChild(imgEl);
            }
          } catch (e) { console.warn('Failed to display guide image', e); }
        };
        pre.onerror = function() {
          if (typeof window.showToast === 'function') {
            window.showToast('Guide image not found: ' + path, 'warning', 5000);
          } else {
            alert('Guide image not found: ' + path);
          }
          closeGuideModal();
        };
        // Start loading
        pre.src = path;
      } catch (e) {
        console.warn('Preload failed', e);
      }

    } catch (err) {
      console.warn('showGuideImage failed', err);
    }
  }

  // expose
  window.showGuideImage = showGuideImage;

  console.log('✅ ui_helpers loaded');

  // initialize toolbar when DOM ready
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initSideToolbar); else initSideToolbar();
})();