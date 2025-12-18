// data_loader.js - Client-side data loading module
(function() {
  'use strict';

  const DL = {
    /**
     * Load data directly from Google Sheets using service account (no server, no OAuth)
     * @param {HTMLElement} statusEl - Optional status element to update
     */
    async loadFromGoogleSheets(statusEl) {
      // --- Helper functions are available as methods: showLoadingOverlay / setLoadingOverlayMessage / hideLoadingOverlay ---

      // Soft loading overlay: show a non-blocking indicator while loading
      this.showLoadingOverlay();
      if (statusEl) { statusEl.textContent = '⏳ Authenticating with service account...'; }
      // Remove previous loaded indicator while running
      const loadBtn = document.querySelector('.toolbar-btn[data-action="loadData"]');
      if (loadBtn) loadBtn.classList.remove('loaded');

      try {
        const SPREADSHEET_ID = window.GOOGLE_SPREADSHEET_ID || '17gh8MZSeFVPQudyTGwYf5_pFWH8yt-xpCPiPy9i8x-U';

        // Use service account for authentication
        if (!window.ServiceAccountAuth) {
          throw new Error('ServiceAccountAuth not loaded. Please include service_account_auth.js');
        }

        if (statusEl) { statusEl.textContent = '⏳ Loading contacts from Google Sheets...'; }

        // Load Contacts using service account authentication
        const CONTACTS_RANGE = window.CONTACTS_RANGE || 'Contacts!A1:BL1000';
        const contactsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(CONTACTS_RANGE)}`;
        const contactsResponse = await window.ServiceAccountAuth.fetch(contactsUrl);
        if (!contactsResponse.ok) {
          const error = await contactsResponse.json().catch(() => ({}));
          throw new Error(error.error?.message || `Failed to load contacts: ${contactsResponse.status}`);
        }
        const contactsData = await contactsResponse.json();
        const contacts = this.parseValuesToObjects(contactsData.values || []);
        
        if (contacts.length > 0) {
          window.clientsData = contacts;
          window.csvFileUploaded = true;
          
          if (typeof window.saveClientsToLocalStorage === 'function') {
            try { window.saveClientsToLocalStorage(); } catch(e) { console.warn('saveClientsToLocalStorage failed', e); }
          }
          if (typeof window.refreshAllClientReferences === 'function') {
            try { window.refreshAllClientReferences(); } catch(e) { console.warn('refreshAllClientReferences failed', e); }
          }
          
          console.log(`✅ Loaded ${contacts.length} contacts`);
        }

        if (statusEl) { statusEl.textContent = '⏳ Loading payments from Google Sheets...'; }

        // Load Payments using service account authentication
        const PAYMENTS_RANGE = window.PAYMENTS_RANGE || 'Customer Payments!A1:Z1000';
        const paymentsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(PAYMENTS_RANGE)}`;
        const paymentsResponse = await window.ServiceAccountAuth.fetch(paymentsUrl);
        if (!paymentsResponse.ok) {
          const error = await paymentsResponse.json().catch(() => ({}));
          throw new Error(error.error?.message || `Failed to load payments: ${paymentsResponse.status}`);
        }
        const paymentsData = await paymentsResponse.json();
        const payments = this.parseValuesToObjects(paymentsData.values || []);
        
        if (payments.length > 0) {
          window.paymentsData = payments;
          window.paymentFileUploaded = payments.length > 0;
          console.log(`✅ Loaded ${payments.length} payments`);
        }

        if (statusEl) { statusEl.textContent = '⏳ Loading invoices from Google Sheets...'; }

        // Load Invoices using service account authentication
        const INVOICES_RANGE = window.INVOICES_RANGE || 'Invoices!A1:DM2000';
        const invoicesUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(INVOICES_RANGE)}`;
        const invoicesResponse = await window.ServiceAccountAuth.fetch(invoicesUrl);
        if (!invoicesResponse.ok) {
          const error = await invoicesResponse.json().catch(() => ({}));
          throw new Error(error.error?.message || `Failed to load invoices: ${invoicesResponse.status}`);
        }
        const invoicesData = await invoicesResponse.json();
        const invoices = this.parseValuesToObjects(invoicesData.values || []);
        
        if (invoices.length > 0) {
          window.invoicesData = invoices;
          window.allInvoices = [];
          invoices.forEach(row => window.allInvoices.push(row));

          // Sync UI
          if (typeof window.syncGlobalArrays === 'function') window.syncGlobalArrays();
          if (typeof window.updateUniqueInvoiceNumbers === 'function') window.updateUniqueInvoiceNumbers();
          if (typeof window.initializeFilterClientDropdown === 'function') window.initializeFilterClientDropdown();

          window.invoiceFileUploaded = true;
          if (typeof window.updateUploadStatus === 'function') window.updateUploadStatus();
          if (typeof window.afterDatabaseUpdate === 'function') window.afterDatabaseUpdate();

          console.log(`✅ Loaded ${invoices.length} invoices`);

          // Auto-select last invoice
          if (typeof window.dataLoader !== 'undefined' && typeof window.dataLoader.findLastInvoiceByReference === 'function') {
            const lastInvoice = window.dataLoader.findLastInvoiceByReference();
            if (lastInvoice) {
              const lastInvoiceNum = lastInvoice['Invoice Number'] || lastInvoice['invoiceNumber'] || lastInvoice['invoice_number'] || '';
                if (lastInvoiceNum) {
                if (typeof window.updateUniqueInvoiceNumbers === 'function') window.updateUniqueInvoiceNumbers();
                if (Array.isArray(window.uniqueInvoiceNumbers)) {
                  const lastIndex = window.uniqueInvoiceNumbers.indexOf(lastInvoiceNum);
                  if (lastIndex !== -1) {
                    window.currentInvoiceIndex = lastIndex;
                    if (typeof window.showInvoice === 'function') window.showInvoice(lastIndex);
                    if (typeof window.updateInvoiceNavButtons === 'function') window.updateInvoiceNavButtons();
                    // prefer showing a compact toolbar indicator instead of a long success text
                    if (statusEl) statusEl.textContent = '';
                    const loadBtn = document.querySelector('.toolbar-btn[data-action="loadData"]');
                    if (loadBtn) loadBtn.classList.add('loaded');
                    // Hide overlay on success
                    this.hideLoadingOverlay();
                    
                    // Check for message updates after data loads
                    console.log('📨 Data loaded successfully, checking for message updates...');
                    if (typeof window.checkMessageUpdates === 'function') {
                      console.log('📨 Calling window.checkMessageUpdates()');
                      window.checkMessageUpdates();
                    }
                    // Load bundles if a bundle loader is present
                    try {
                      if (typeof window.loadBundlesFromGoogleSheets === 'function') {
                        console.log('🔁 Loading Bundles sheet via window.loadBundlesFromGoogleSheets');
                        try { await window.loadBundlesFromGoogleSheets(statusEl); } catch(e) { console.warn('data_loader: loadBundlesFromGoogleSheets threw', e); }
                      }
                    } catch(e) { console.warn('data_loader: failed invoking loadBundlesFromGoogleSheets', e); }
                    return;
                  }
                }
              }
            }
          }

          if (statusEl) statusEl.textContent = '';
          const loadBtn = document.querySelector('.toolbar-btn[data-action="loadData"]');
          if (loadBtn) loadBtn.classList.add('loaded');
          
          // Hide overlay on success
          this.hideLoadingOverlay();

          // Check for message updates after data loads
          console.log('📨 Data loaded successfully, checking for message updates...');
          console.log('📨 window.checkMessageUpdates exists?', typeof window.checkMessageUpdates === 'function');
          if (typeof window.checkMessageUpdates === 'function') {
            console.log('📨 Calling window.checkMessageUpdates()');
            window.checkMessageUpdates();
          } else {
            console.log('❌ window.checkMessageUpdates is not available');
          }
        } else {
          if (statusEl) { statusEl.textContent = '⚠️ No invoices found in Google Sheets'; this.hideLoadingOverlay(); }
        }

      } catch (error) {
        console.error('Error loading from Google Sheets:', error);
        const msg = error.message || String(error);
        // Hide overlay on error
        this.hideLoadingOverlay();
        
        // Show concise error in status
          if (statusEl) {
          if (msg.includes('403') || msg.includes('Permission Denied')) {
            statusEl.innerHTML = `❌ Permission Denied - <a href="FIX_403_ERROR.md" target="_blank" style="color: #2196F3; text-decoration: underline;">See Fix Instructions</a>`;
          } else {
            statusEl.textContent = `❌ ${msg.split('\n')[0]}`;
          }
        }
        
        // Show detailed error in alert for 403 errors
          if (msg.includes('403') || msg.includes('Permission Denied')) {
          alert(
            '❌ PERMISSION DENIED (403)\n\n' +
            'Your spreadsheet is private and cannot be accessed with API Key.\n\n' +
            '✅ QUICK FIX:\n' +
            '1. Open your Google Sheet\n' +
            '2. Click "Share" button\n' +
            '3. Change to "Anyone with the link" → "Viewer"\n' +
            '4. Try loading again\n\n' +
            'See FIX_403_ERROR.md for detailed instructions.'
          );
          } else {
            // don't show blocking alert; log only
            console.warn('Failed to load from Google Sheets:', msg);
        }
      }
    },

    /**
     * Load invoices from CSV file using PapaParse
     * @param {File} file - The CSV file to parse
     */
    async loadInvoicesCSV(file) {
      return new Promise((resolve, reject) => {
        if (typeof Papa === 'undefined') {
          reject(new Error('PapaParse library not loaded'));
          return;
        }

        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: function(results) {
            if (results.data && results.data.length > 0) {
              window.invoicesData = results.data;
              window.allInvoices = [];
              results.data.forEach(row => window.allInvoices.push(row));

              if (typeof window.syncGlobalArrays === 'function') window.syncGlobalArrays();
              if (typeof window.updateUniqueInvoiceNumbers === 'function') window.updateUniqueInvoiceNumbers();
              if (typeof window.initializeFilterClientDropdown === 'function') window.initializeFilterClientDropdown();

              window.invoiceFileUploaded = true;
              if (typeof window.updateUploadStatus === 'function') window.updateUploadStatus();

              console.log(`✅ Loaded ${results.data.length} invoices from CSV`);
              resolve(results.data);
            } else {
              reject(new Error('No data found in CSV file'));
            }
          },
          error: function(error) {
            console.error('CSV parse error:', error);
            reject(error);
          }
        });
      });
    },

    /**
     * Load clients from CSV file using PapaParse
     * @param {File} file - The CSV file to parse
     */
    async loadClientsCSV(file) {
      return new Promise((resolve, reject) => {
        if (typeof Papa === 'undefined') {
          reject(new Error('PapaParse library not loaded'));
          return;
        }

        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: function(results) {
            if (results.data && results.data.length > 0) {
              window.clientsData = results.data;
              window.csvFileUploaded = true;

              if (typeof window.saveClientsToLocalStorage === 'function') {
                try { window.saveClientsToLocalStorage(); } catch(e) { console.warn('saveClientsToLocalStorage failed', e); }
              }
              if (typeof window.refreshAllClientReferences === 'function') {
                try { window.refreshAllClientReferences(); } catch(e) { console.warn('refreshAllClientReferences failed', e); }
              }

              console.log(`✅ Loaded ${results.data.length} clients from CSV`);
              resolve(results.data);
            } else {
              reject(new Error('No data found in CSV file'));
            }
          },
          error: function(error) {
            console.error('CSV parse error:', error);
            reject(error);
          }
        });
      });
    },

    /**
     * Load data from localStorage as fallback
     */
    loadFromLocalStorage() {
      try {
        // Load clients
        const storedClients = localStorage.getItem('invoiceApp_clients');
        if (storedClients) {
          const clients = JSON.parse(storedClients);
          if (Array.isArray(clients) && clients.length > 0) {
            window.clientsData = clients;
            window.csvFileUploaded = true;
            console.log(`✅ Loaded ${clients.length} clients from localStorage`);
          }
        }

        // Load invoices
        const storedInvoices = localStorage.getItem('invoiceApp_invoices');
        if (storedInvoices) {
          const invoices = JSON.parse(storedInvoices);
          if (Array.isArray(invoices) && invoices.length > 0) {
            window.invoicesData = invoices;
            window.allInvoices = [];
            invoices.forEach(row => window.allInvoices.push(row));
            window.invoiceFileUploaded = true;
            console.log(`✅ Loaded ${invoices.length} invoices from localStorage`);
          }
        }

        // Load payments
        const storedPayments = localStorage.getItem('invoiceApp_payments');
        if (storedPayments) {
          const payments = JSON.parse(storedPayments);
          if (Array.isArray(payments) && payments.length > 0) {
            window.paymentsData = payments;
            window.paymentFileUploaded = true;
            console.log(`✅ Loaded ${payments.length} payments from localStorage`);
          }
        }

        return true;
      } catch (error) {
        console.error('Error loading from localStorage:', error);
        return false;
      }
    },

    /**
     * Parse values array from Google Sheets to array of objects
     * @param {Array<Array>} values - 2D array from Google Sheets (first row = headers)
     * @returns {Array<object>} Array of objects
     */
    parseValuesToObjects(values) {
      if (!Array.isArray(values) || values.length === 0) return [];
      
      const headers = values[0] || [];
      const rows = values.slice(1) || [];
      
      return rows.map(r => {
        const obj = {};
        headers.forEach((h, i) => { 
          obj[h] = r[i] !== undefined ? r[i] : ''; 
        });
        return obj;
      }).filter(row => Object.values(row).some(v => String(v).trim() !== ''));
    },

    /**
     * Find the last invoice by reference
     * Used for auto-selecting the most recent invoice
     */
    findLastInvoiceByReference() {
      if (!Array.isArray(window.allInvoices) || window.allInvoices.length === 0) {
        return null;
      }

      // Sort by invoice number (descending) and return the first
      const sorted = [...window.allInvoices].sort((a, b) => {
        // Try both field name variants
        const getInvoiceNum = (inv) => {
          const num = inv['Invoice Number'] || inv['invoiceNumber'] || inv['invoice_number'] || '';
          return parseInt(String(num).replace(/\D/g, '')) || 0;
        };
        const numA = getInvoiceNum(a);
        const numB = getInvoiceNum(b);
        return numB - numA; // Descending order (largest first)
      });

      return sorted[0] || null;
    }
  };

  // Expose to window
  // Loading overlay helpers
  DL.showLoadingOverlay = function(){
    try {
      if (document.getElementById('softDataLoaderOverlay')) return;
      const overlay = document.createElement('div');
      overlay.id = 'softDataLoaderOverlay';
      overlay.className = 'soft-loading-overlay';
      overlay.innerHTML = `
        <div class="soft-loading-box">
          <div class="soft-loading-message">Getting things ready for you..</div>
          <div class="soft-spinner" aria-hidden="true"></div>
        </div>
      `;
      document.body.appendChild(overlay);
    } catch(e){ console.warn('showLoadingOverlay failed', e); }
  };

  DL.setLoadingOverlayMessage = function(msg){
    try { const o = document.getElementById('softDataLoaderOverlay'); if (!o) return; const msgEl = o.querySelector('.soft-loading-message'); if (msgEl) msgEl.textContent = 'Getting things ready for you..'; } catch(e){ /* noop */ }
  };

  DL.hideLoadingOverlay = function(){
    try { const o = document.getElementById('softDataLoaderOverlay'); if (o) o.remove(); } catch(e){ /* noop */ }
  };

  window.dataLoader = DL;
  window.DL = DL;

  console.log('✅ data_loader.js loaded');
})();
