// bundle-ui.js — UI code for Bundle Manager modal (uses bundleModel & bundleUtils)
(function(){
  'use strict';

  function openAddBundleModal() {
    // We'll reuse the previous logic, but call into bundleModel and bundleUtils
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'bundlesModalOverlay';

    const content = document.createElement('div');
    content.className = 'modal-content';

    const header = document.createElement('div');
    header.className = 'modal-header';
    header.innerHTML = `\n      <h3>Bundle Manager</h3>\n     
     <div class=\"header-controls\">\n        
     <input type=\"text\" class=\"bundle-search-input\" id=\"bundleSearchInput\" placeholder=\"Search bundles...\" style=\"padding: 4px 8px; margin-right: 10px; border: 1px solid #ccc; border-radius: 4px; width: 200px;\">\n        
    
     <button type=\"button\" class=\"btn prev-btn\" title=\"Previous\">Prev</button>\n        
    <button type=\"button\" class=\"btn nav-index\" aria-hidden=\"true\">0 / 0</button>\n       
     <button type=\"button\" class=\"btn next-btn\" title=\"Next\">Next</button>\n        
     <button class=\"modal-close\" title=\"Close\">&times;</button>\n      
     </div>\n    `;

    const body = document.createElement('div');
    body.className = 'modal-body';
    body.innerHTML = `\n      <div class=\"form-grid\">\n
            <div>\n          <label>Bundle Name</label>\n
            <input class="bundle-input" type=\"text\" id=\"bundleName\" placeholder=\"Bundle name\">\n        
            </div>\n        
            <div>\n          
            <label>Bundle Expiry</label>\n          
            <input class="bundle-input" type=\"date\" id=\"bundleExpiry\">\n        
            </div>\n        
            <div>\n          
            <label>Text Before</label>\n          
            <input class="bundle-input" type=\"text\" id=\"bundleTextBefore\">\n        
            </div>\n        
            <div>\n          
            <label>Defendant</label>\n          
            <input class="bundle-input" type=\"text\" id=\"bundleDefendant\">\n        
            </div>\n        
            <div>\n          
            <label>Text After</label>\n          
            <input class="bundle-input" type=\"text\" id=\"bundleTextAfter\">\n        
            </div>\n        
            <div>\n          
            <label>Client Name</label>\n          
            <select class="bundle-input" id=\"bundleClientName\"></select>\n        
            </div>\n      
            </div>\n\n      
            <div class=\"table-scroll\">\n        
            <table class=\"bundle-items-table\">\n          
            <thead>\n            
            <tr>\n              
            <th style="width: 40%;">Bundle Item</th>\n              
            <th style="width: 10%;">Qty</th>\n              
            <th style="width: 15%;">Price</th>\n              
            <th style="width: 15%;">Taxable</th>\n              
            <th style="width: 15%;">Total</th>\n              
            <th style="width: 5%;"></th>\n            
            </tr>\n         
            </thead>\n          
            <tbody id=\"bundleItemsBody\"></tbody>\n        
            </table>\n        
            <div class=\"table-actions\">\n          
            <div>\n           
             <button type=\"button\" class=\"btn add-line-btn\">Add Item</button>\n          
             </div>\n          
             <div class=\"grand-total\">Grand Total: AED <span id=\"bundleItemsGrandTotal\">0.00</span></div>\n        
             </div>\n      
             </div>\n\n      
             <div class=\"notes-row\">\n        
             <label>Notes</label>\n        
             <input class="bundle-input" type=\"text\" id=\"bundleNotes\" maxlength=\"200\" placeholder=\"Notes (max 200 chars)\">\n
                </div>\n\n
                <div class=\"options-row\">\n
             <label for="addBrackets" >Add brackets around item names</label>\n
             <input type=checkbox id="addBrackets" class="bundle-checkbox" checked/>      
            <i id="bundleInfoIcon" class="bi bi-info-circle-fill"></i> </div>\n
            </div>\n
            \n    `;
    
      // Status element for saves/appends
      const statusEl = document.createElement('div');
      statusEl.id = 'bundlesSaveStatus';
      statusEl.className = 'bundles-save-status';
      statusEl.style.margin = '';
      statusEl.style.fontSize = '13px';
      statusEl.style.color = 'var(--muted-gray, #6b7280)';
      body.appendChild(statusEl);

    const actions = document.createElement('div');
    actions.className = 'form-actions';
    actions.innerHTML = `\n  
    <div class="action-bar">   \n  

        <button type=\"button\" class=\"cancel-btn btn\" id=\"cancelBundleBtn\">Cancel</button>\n 
        <button type=\"button\" class=\"btn btn-append\" id=\"getFromInvoiceBtn\">Get From Invoice</button>\n
    </div>\n   
    <div class="action-bar">\n    
     <button type=\"button\" class=\"btn btn-danger\" id=\"deleteBundleBtn\">Delete</button>\n
        
     
    <button type=\"button\" class=\"btn btn-success\" id=\"newBundleBtn\">New</button>\n     
    <button type=\"button\" class=\"btn btn-append\" id=\"saveBundleBtn\">Save</button>\n   
    <button type=\"button\" class=\"btn btn-append\" id=\"sendToInvoiceBtn\">Send to Invoice</button>\n;
     </div>\n    `;
    content.appendChild(header);
    content.appendChild(body);
    content.appendChild(actions);
    overlay.appendChild(content);

    // Create references
    const prevBtn = header.querySelector('.prev-btn');
    const nextBtn = header.querySelector('.next-btn');
    const navIndexEl = header.querySelector('.nav-index');
    const closeBtn = header.querySelector('.modal-close');
    const saveBtn = actions.querySelector('#saveBundleBtn');
    const cancelBtn = actions.querySelector('#cancelBundleBtn');
    const newBtn = actions.querySelector('#newBundleBtn');
    const deleteBtn = actions.querySelector('#deleteBundleBtn');

    closeBtn.onclick = closeBundleModal;
    cancelBtn.onclick = closeBundleModal;

    // Prepare dynamic helpers
    let currentIndex = null; // null = creating new
    let filteredIndices = []; // Array of indices that match search filter
    let currentFilteredPosition = -1; // Position within filteredIndices array

    // Local helper: format date for sheet (DD/MM/YYYY)
    function formatDateForSheet(input) {
      if (!input && input !== 0) return '';
      if (input instanceof Date) {
        const d = input;
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
      }
      const s = String(input).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const [y, m, d] = s.split('-');
        return `${d.padStart(2,'0')}/${m.padStart(2,'0')}/${y}`;
      }
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) return s;
      const tryDate = new Date(s);
      if (!isNaN(tryDate)) return formatDateForSheet(tryDate);
      return s;
    }

    function renderNavIndicator() {
      const total = (window.bundleModel && typeof window.bundleModel.getBundles === 'function') ? (window.bundleModel.getBundles().length) : (window.bundlesData || []).length;
      const isFiltered = filteredIndices.length > 0 && filteredIndices.length < total;
      const displayTotal = isFiltered ? filteredIndices.length : total;
      const pos = currentIndex == null ? 0 : (isFiltered ? (currentFilteredPosition + 1) : (currentIndex + 1));
      if (navIndexEl) navIndexEl.textContent = `${pos} / ${displayTotal}${isFiltered ? ' (filtered)' : ''}`;
    }

    function updateButtonsState() {
      const total = (window.bundleModel && typeof window.bundleModel.getBundles === 'function') ? (window.bundleModel.getBundles().length) : (window.bundlesData || []).length;
      const isFiltered = filteredIndices.length > 0 && filteredIndices.length < total;
      const effectiveTotal = isFiltered ? filteredIndices.length : total;
      
      if (isFiltered) {
        prevBtn.disabled = (currentFilteredPosition <= 0);
        nextBtn.disabled = (currentFilteredPosition >= effectiveTotal - 1);
      } else {
        prevBtn.disabled = (currentIndex == null || currentIndex <= 0);
        nextBtn.disabled = (currentIndex == null || currentIndex >= (total - 1));
      }
      
      deleteBtn.disabled = (currentIndex == null);
      saveBtn.textContent = (currentIndex == null) ? 'Save' : 'Update';
      renderNavIndicator();
    }

    // Row helpers
    const tbody = body.querySelector('#bundleItemsBody');
    function appendRow() {
      const tr = document.createElement('tr');
      window.bundleUtils.createBundleItemRow(tr);
      tbody.appendChild(tr);
      const qty = tr.querySelector('.bundle-item-qty');
      const price = tr.querySelector('.bundle-item-price');
      const rm = tr.querySelector('.remove-btn');
      if (qty) qty.addEventListener('input', () => window.bundleUtils.updateRowTotal(tr));
      if (price) price.addEventListener('input', () => window.bundleUtils.updateRowTotal(tr));
      if (rm) rm.onclick = () => { tr.remove(); window.bundleUtils.updateGrandTotal(tbody); };
      window.bundleUtils.updateRowTotal(tr);
    }

    // Load helpers
    function clearForm() {
      currentIndex = null;
      body.querySelector('#bundleName').value = '';
      body.querySelector('#bundleExpiry').value = '';
      body.querySelector('#bundleTextBefore').value = '';
      body.querySelector('#bundleDefendant').value = '';
      body.querySelector('#bundleTextAfter').value = '';
      body.querySelector('#bundleClientName').value = '';
      body.querySelector('#bundleNotes').value = '';
      tbody.innerHTML = '';
      appendRow();
      updateButtonsState();
    }

    function loadBundle(idx) {
      const bundles = (window.bundleModel && typeof window.bundleModel.getBundles === 'function') ? window.bundleModel.getBundles() : (window.bundlesData || []);
      if (!Array.isArray(bundles) || !bundles[idx]) return;
      const b = bundles[idx];
      currentIndex = idx;
      
      // Update filtered position if filtering is active
      if (filteredIndices.length > 0) {
        currentFilteredPosition = filteredIndices.indexOf(idx);
      }
      body.querySelector('#bundleName').value = b.bundleName || '';
      
      // Convert DD/MM/YYYY to YYYY-MM-DD for date input
      let expiryValue = '';
      if (b.bundleExpiry) {
        const dateStr = String(b.bundleExpiry).trim();
        // Check if it's in DD/MM/YYYY format
        const ddmmyyyyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (ddmmyyyyMatch) {
          const [, day, month, year] = ddmmyyyyMatch;
          expiryValue = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        } else {
          expiryValue = dateStr;
        }
      }
      body.querySelector('#bundleExpiry').value = expiryValue;
      
      body.querySelector('#bundleTextBefore').value = b.textBefore || '';
      body.querySelector('#bundleDefendant').value = b.defendant || '';
      body.querySelector('#bundleTextAfter').value = b.textAfter || '';
      body.querySelector('#bundleClientName').value = b.clientName || '';
      body.querySelector('#bundleNotes').value = b.notes || '';
      tbody.innerHTML = '';
      (b.items || []).forEach(it => {
        const tr = document.createElement('tr');
        window.bundleUtils.createBundleItemRow(tr);
        tbody.appendChild(tr);
        tr.querySelector('.bundle-item-name').value = it.name || '';
        tr.querySelector('.bundle-item-qty').value = it.qty || 0;
        tr.querySelector('.bundle-item-price').value = it.price || 0;
        const taxableSelect = tr.querySelector('.bundle-item-taxable');
        if (taxableSelect) taxableSelect.value = it.taxable || 'Standard';
        const qty = tr.querySelector('.bundle-item-qty');
        const price = tr.querySelector('.bundle-item-price');
        const rm = tr.querySelector('.remove-btn');
        if (qty) qty.addEventListener('input', () => window.bundleUtils.updateRowTotal(tr));
        if (price) price.addEventListener('input', () => window.bundleUtils.updateRowTotal(tr));
        if (rm) rm.onclick = () => { tr.remove(); window.bundleUtils.updateGrandTotal(tbody); };
        window.bundleUtils.updateRowTotal(tr);
      });
      window.bundleUtils.updateGrandTotal(tbody);
      updateButtonsState();
    }

    // Populate client dropdown function
    function populateClientDropdown() {
      const select = body.querySelector('#bundleClientName');
      if (!select) return;
      select.innerHTML = '<option value="">Select client</option>';
      const uniqueClients = new Set();
      const contactStatusMap = {};
      const anyStatusPresent = Array.isArray(window.clientsData) && window.clientsData.some(c => (c['Status'] || c['status'] || '').toString().trim() !== '');
      
      if (Array.isArray(window.clientsData) && window.clientsData.length) {
        window.clientsData.forEach(c => {
          const name = (c['Display Name'] || c['Client Name'] || c['Company Name'] || c['Name'] || '').toString().trim();
          if (!name) return;
          const st = (c['Status'] || c['status'] || '').toString().trim().toLowerCase();
          contactStatusMap[name.toLowerCase()] = st;
          uniqueClients.add(name);
        });
      }
      if (uniqueClients.size === 0 && Array.isArray(window.allInvoices)) {
        window.allInvoices.forEach(inv => {
          const n = (inv['Customer Name'] || inv['Client Name'] || '') || '';
          if (n) uniqueClients.add(n.toString().trim());
        });
      }
      
      // Check the showInactiveClients setting
      const showInactiveGlobally = (window.settings && typeof window.settings.loadShowInactive === 'function') ? window.settings.loadShowInactive() : (localStorage.getItem('app_settings_showInactiveClients') === '1');
      
      const freq = {};
      (window.allInvoices || []).forEach(inv => {
        const cname = String(inv['Customer Name'] || inv['Client Name'] || '').trim();
        if (!cname) return;
        const k = cname.toLowerCase();
        freq[k] = (freq[k] || 0) + 1;
      });
      
      // Filter out inactive clients if necessary
      const filtered = Array.from(uniqueClients).filter(name => {
        if (!anyStatusPresent || showInactiveGlobally) return true;
        const status = contactStatusMap[name.toLowerCase()] || '';
        return status === 'active' || status === 'a';
      });
      
      const sorted = filtered.sort((a,b)=>{
        const ca = freq[(a||'').toLowerCase()] || 0;
        const cb = freq[(b||'').toLowerCase()] || 0;
        if (cb - ca !== 0) return cb - ca;
        return a.localeCompare(b);
      });
      sorted.forEach(s => {
        const opt = document.createElement('option'); opt.value = s; opt.textContent = s.length > 35 ? s.substring(0,35) + '...' : s; opt.title = s; select.appendChild(opt);
      });
      if (sorted.length === 0) {
        const opt = document.createElement('option'); opt.value=''; opt.textContent='No clients found'; opt.disabled=true; select.appendChild(opt);
      }
    }

    // Search and filter functionality
    function performSearch(searchText) {
      const bundles = (window.bundleModel && typeof window.bundleModel.getBundles === 'function') 
        ? window.bundleModel.getBundles() 
        : (window.bundlesData || []);
      
      const searchLower = searchText.toLowerCase().trim();
      
      if (!searchLower) {
        // No search text - show all bundles
        filteredIndices = [];
        currentFilteredPosition = -1;
        updateButtonsState();
        return;
      }
      
      // Search through all bundle fields
      filteredIndices = [];
      bundles.forEach((bundle, index) => {
        const searchableText = [
          bundle.bundleName || '',
          bundle.clientName || '',
          bundle.defendant || '',
          bundle.textBefore || '',
          bundle.textAfter || '',
          bundle.notes || '',
          ...(bundle.items || []).map(item => item.name || '')
        ].join(' ').toLowerCase();
        
        if (searchableText.includes(searchLower)) {
          filteredIndices.push(index);
        }
      });
      
      // Load first matching bundle if current bundle doesn't match
      if (filteredIndices.length > 0) {
        if (currentIndex === null || !filteredIndices.includes(currentIndex)) {
          currentFilteredPosition = 0;
          loadBundle(filteredIndices[0]);
        } else {
          currentFilteredPosition = filteredIndices.indexOf(currentIndex);
          updateButtonsState();
        }
      } else {
        // No matches found
        currentFilteredPosition = -1;
        updateButtonsState();
      }
    }
    
    const searchInput = header.querySelector('#bundleSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        performSearch(e.target.value);
      });
    }

    // Event bindings
    body.querySelector('.add-line-btn').onclick = appendRow;

    prevBtn.onclick = () => { 
      if (currentIndex === null) return;
      
      const isFiltered = filteredIndices.length > 0;
      if (isFiltered) {
        if (currentFilteredPosition > 0) {
          currentFilteredPosition--;
          loadBundle(filteredIndices[currentFilteredPosition]);
        }
      } else {
        if (currentIndex > 0) loadBundle(currentIndex - 1);
      }
    };
    
    nextBtn.onclick = () => { 
      if (currentIndex === null) return;
      
      const isFiltered = filteredIndices.length > 0;
      if (isFiltered) {
        if (currentFilteredPosition < filteredIndices.length - 1) {
          currentFilteredPosition++;
          loadBundle(filteredIndices[currentFilteredPosition]);
        }
      } else {
        const total = (window.bundleModel && typeof window.bundleModel.getBundles === 'function') 
          ? window.bundleModel.getBundles().length 
          : (window.bundlesData||[]).length;
        if (currentIndex < total - 1) loadBundle(currentIndex + 1);
      }
    };

    newBtn.onclick = () => {
      // New should not auto-save — only open a blank form for the user to enter new data.
      const bundleNameCurrent = body.querySelector('#bundleName')?.value.trim() || '';
      const clientNameCurrent = body.querySelector('#bundleClientName')?.value.trim() || '';
      const rowsPresent = tbody.querySelectorAll('tr');
      const hasItems = rowsPresent && rowsPresent.length > 0 && Array.from(rowsPresent).some(tr => tr.querySelector('.bundle-item-name')?.value.trim());

      const hasContent = Boolean(bundleNameCurrent || clientNameCurrent || hasItems || currentIndex !== null);
      if (hasContent) {
        // If there is existing content, ask the user before discarding. Inform them to use Save to persist.
        const confirmDiscard = confirm('You have unsaved changes. Click Save to persist to Google Sheets, or click OK to discard changes and create a new bundle. Proceed?');
        if (!confirmDiscard) return;
      }
      // Clear the form and set currentIndex to null (create mode). Do NOT save or append anything.
      clearForm();
      currentIndex = null;
      setTimeout(()=>{const el=document.getElementById('bundleName'); if (el) el.focus();},50);
    };
    
    // Get From Invoice button handler
    const getFromInvoiceBtn = actions.querySelector('#getFromInvoiceBtn');
    if (getFromInvoiceBtn) {
      getFromInvoiceBtn.onclick = () => {
        if (typeof window.bundleFromInvoice === 'function') {
          window.bundleFromInvoice(tbody, body);
        } else {
          console.warn('bundleFromInvoice function not available');
        }
      };
    }
    deleteBtn.onclick = async () => {
      if (currentIndex === null) { alert('No bundle selected to delete'); return; }
      if (!confirm('Delete this bundle permanently?')) return;
      const idx = currentIndex;
      
      try {
        // Get bundle data before deletion
        const bundles = (window.bundleModel && typeof window.bundleModel.getBundles === 'function') 
          ? window.bundleModel.getBundles() 
          : (window.bundlesData || []);
        const bundle = bundles[idx];
        
        if (!bundle) {
          alert('Bundle not found');
          return;
        }
        
        // Delete from Google Sheets first
        const bundleId = bundle.id || bundle.bundleId;
        if (bundleId && typeof window.deleteBundleFromGoogleSheets === 'function') {
          try {
            await window.deleteBundleFromGoogleSheets(bundleId);
          } catch (err) {
            console.error('Failed to delete from Google Sheets:', err);
          }
        }
        
        // Delete from local model
        if (window.bundleModel && typeof window.bundleModel.deleteBundle === 'function') {
          window.bundleModel.deleteBundle(idx);
        } else if (Array.isArray(window.bundlesData)) {
          window.bundlesData.splice(idx, 1);
          try { localStorage.setItem('invoiceApp_bundles', JSON.stringify(window.bundlesData)); } catch(e) {}
        }
        
        const nextTotal = (window.bundleModel && typeof window.bundleModel.getBundles === 'function') ? window.bundleModel.getBundles().length : (window.bundlesData || []).length;
        if (nextTotal === 0) { clearForm(); updateButtonsState(); return; }
        const newIndex = Math.min(idx, nextTotal - 1);
        loadBundle(newIndex);
      } catch(e) { 
        console.error('Failed to delete bundle:', e); 
        alert('Failed to delete bundle: ' + (e.message || e)); 
      }
    };

    // Save handler is now implemented in bundle-ui-save.js
    // Wire the save button to the external module if present
    saveBtn.onclick = async () => {
      if (window.bundleUISave && typeof window.bundleUISave.performSave === 'function') {
        await window.bundleUISave.performSave({ showStatus: true });
      } else if (typeof performSave === 'function') {
        await performSave({ showStatus: true });
      }
    };

    // Populate clients
    populateClientDropdown();

    // initialize state — load last bundle or clear
    const modelLastIndex = (window.bundleModel && typeof window.bundleModel.findLastIndex === 'function') ? window.bundleModel.findLastIndex() : ((window.bundlesData||[]).length - 1);
    if (modelLastIndex >= 0) loadBundle(modelLastIndex); else clearForm();

    document.body.appendChild(overlay);
    setTimeout(() => { const el=document.getElementById('bundleName'); if (el) el.focus(); }, 100);
    document.body.style.overflow = 'hidden';
    
    // Initialize bundle preview tooltip
    if (typeof window.initBundlePreview === 'function') {
      setTimeout(() => window.initBundlePreview(), 100);
    }
    
    // Initialize send to invoice button
    if (typeof window.initSendToInvoiceButton === 'function') {
      setTimeout(() => window.initSendToInvoiceButton(), 100);
    }

    // Expose programmatic API and manager global for external modules
    try {
      window.bundleUI = window.bundleUI || {};
      window.bundleUI.openAddBundleModal = openAddBundleModal;
        // Also expose top-level convenience function for backward compatibility
        window.openAddBundleModal = openAddBundleModal;
    } catch(e) {console.log('bundle-ui: failed to expose bundleUI API', e); }

    try {
      window._bundleManagerGlobal = window._bundleManagerGlobal || {};
      window._bundleManagerGlobal.loadBundleToForm = loadBundle;
      window._bundleManagerGlobal.updateNavButtons = updateButtonsState;
      window._bundleManagerGlobal.clearForm = clearForm;
      window._bundleManagerGlobal.setCurrentBundleIndex = (i) => { currentIndex = i; updateButtonsState(); };
      window._bundleManagerGlobal.getCurrentBundleIndex = () => currentIndex;
    } catch (e) { console.warn('bundle-ui: failed to expose _bundleManagerGlobal API', e); }
  }

  // Helper close function (used by UI)
  function closeBundleModal() {
    const overlay = document.getElementById('bundlesModalOverlay'); if (overlay) { overlay.remove(); document.body.style.overflow = ''; }
  }

  window.bundleUI = window.bundleUI || {};
  window.bundleUI.openAddBundleModal = openAddBundleModal;
    window.openAddBundleModal = openAddBundleModal;

  console.log('bundle-ui: ready');
})();
