// ============================================
// Client Management Module
// ============================================
// Handles client dropdown, selection, data updates, and related operations

(function() {
    'use strict';

    // --------- Client Dropdown Population ---------

    function populateClientDropdown() {
        const dropdown = document.getElementById('clientDropdown');
        dropdown.innerHTML = '<option value="">-- Select a client --</option>';
        let foundAny = false;
        
        // Always use window.clientsData to get the latest data
        const clients = window.clientsData || [];
        // Determine whether Contacts data contains a Status column at all
        const anyStatusPresent = clients.some(c => (c['Status'] || c['status'] || '').toString().trim() !== '');

        // helper to check active state
        const isActive = (client) => {
            try {
                const v = (client['Status'] || client['status'] || '').toString().trim().toLowerCase();
                return v === 'active' || v === 'a';
            } catch(e){ return false; }
        };

        // build a frequency map from invoices so we can order clients by occurrence
        const freq = {};
        if (Array.isArray(window.allInvoices)) {
            window.allInvoices.forEach(inv => {
                const cname = String(inv['Customer Name'] || inv['Client Name'] || '').trim();
                if (!cname) return;
                const k = cname.toLowerCase();
                freq[k] = (freq[k] || 0) + 1;
            });
        }

        // map clients into a sortable list: keep the original index so selection still works
        const clientRows = clients.map((client, index) => {
            const name = (client['Display Name'] || client['Client Name'] || client['Name'] || client['name'] || client['CLIENT NAME'] || client['client_name'] || '').toString().trim();
            const key = name.toLowerCase();
            const status = ((client['Status']||client['status']||'')+'').toLowerCase().trim();
            const count = freq[key] || 0;
            return { index, name, status, count, raw: client };
        });
        // filter out inactive if required and sort by invoice frequency descending
        const showInactiveGlobally = (window.settings && typeof window.settings.loadShowInactive === 'function') ? window.settings.loadShowInactive() : (localStorage.getItem('app_settings_showInactiveClients') === '1');

        const visibleRows = clientRows.filter(row => {
            if (!row.name) return false;
            if (anyStatusPresent && !showInactiveGlobally && row.status !== 'active') return false;
            return true;
        });

        // debug: show counts for the top clients and current inactive setting
        try {
            const top = visibleRows.slice(0, 6).map(r => `${r.name}(${r.count})`).join(', ');
            console.debug('populateClientDropdown: anyStatusPresent=', anyStatusPresent, 'showInactive=', showInactiveGlobally, 'topClients=', top);
        } catch(e) { /* noop */ }

        visibleRows.sort((a,b)=>{
            if (b.count - a.count !== 0) return b.count - a.count; // highest first
            return a.name.localeCompare(b.name);
        });

        visibleRows.forEach(row => {
            const option = document.createElement('option');
            option.value = row.index; // preserve original index into window.clientsData
            option.textContent = row.name;
            dropdown.appendChild(option);
            foundAny = true;
        });
        dropdown.disabled = !foundAny;
        if (!foundAny) {
            console.warn("No client names detected. Please ensure your data source has a 'Display Name' or 'Client Name' column.");
        }
    }

    // --------- Client Selection Handler ---------

    function selectClient() {
        const dropdown = document.getElementById('clientDropdown');
        const selectedIndex = dropdown.value;
        window.selectedClientRow = null;

        if (selectedIndex === '') {
            // Clear client data if no selection
            document.getElementById('clientNameDisplay').textContent = "";
            document.getElementById('clientAddressDisplay').innerHTML = "";
            document.getElementById('clientTRNDisplay').textContent = "";
            if (document.getElementById('projectCodeInput')) document.getElementById('projectCodeInput').value = "";
            if (document.getElementById('projectCode')) document.getElementById('projectCode').value = "";
                if (document.getElementById('projectCodeDisplay')) document.getElementById('projectCodeDisplay').textContent = '';
                const countryEl = document.getElementById('clientCountryDisplay');
                if (countryEl) { countryEl.textContent = ''; countryEl.style.display = 'none'; }
            return;
        }

        // Get the selected client data (always use window.clientsData)
        const clients = window.clientsData || [];
        window.selectedClientRow = clients[selectedIndex];

        if (!window.selectedClientRow) {
            console.error('Selected client not found in clientsData');
            return;
        }

        console.log('Selected client:', window.selectedClientRow);

        // Build address from client data (handle both CSV and manual entry formats)
        let address = '';
        // Prefer Billing Address and flexible billing columns; fall back to generic address columns
        const adr1 = window.selectedClientRow['Billing Address'] || window.selectedClientRow['Address Line 1'] || window.selectedClientRow['address_line_1'] || window.selectedClientRow['Address1'] || '';
        const adr2 = window.selectedClientRow['Billing Address 2'] || window.selectedClientRow['Address Line 2'] || window.selectedClientRow['address_line_2'] || window.selectedClientRow['Address2'] || '';
        const city = window.selectedClientRow['City'] || window.selectedClientRow['city'] || '';
        const country = window.selectedClientRow['Country'] || window.selectedClientRow['country'] || '';

        // Build formatted address
        if (adr1) address += adr1;
        if (adr2) address += (address ? '<br>' : '') + adr2;
        if (city) address += (address ? '<br>' : '') + city;
        // Note: billing country will be shown separately in clientCountryDisplay

        // Get client name (handle multiple possible field names)
        const clientName = window.selectedClientRow['Display Name'] ||
            window.selectedClientRow['Client Name'] ||
            window.selectedClientRow['Name'] ||
            window.selectedClientRow['name'] ||
            window.selectedClientRow['CLIENT NAME'] ||
            window.selectedClientRow['client_name'] || '';

        // Get TRN (handle multiple possible field names)
        const trn = window.selectedClientRow['Tax Registration Number'] ||
            window.selectedClientRow['TRN Number'] ||
            window.selectedClientRow['TRN'] ||
            window.selectedClientRow['trn_number'] ||
            window.selectedClientRow['trn'] || '';

        // Get project code (handle multiple possible field names)
        const clientProjectCode = window.selectedClientRow['Project Code'] ||
            window.selectedClientRow['project_code'] ||
            window.selectedClientRow['PROJECT CODE'] || '';

        // Update invoice body with client information
        document.getElementById('clientNameDisplay').textContent = clientName;
        document.getElementById('clientAddressDisplay').innerHTML = address;

        // Set the billing country separately below the address when available
        const billingCountry = window.selectedClientRow['Billing Country'] || window.selectedClientRow['Country'] || window.selectedClientRow['billing_country'] || '';
        const countryEl = document.getElementById('clientCountryDisplay');
        if (countryEl) {
            countryEl.textContent = billingCountry || '';
            countryEl.style.display = billingCountry ? 'block' : 'none';
        }

        // Update TRN display
        if (trn) {
            document.getElementById('clientTRNDisplay').textContent = 'TRN ' + trn;
        } else {
            document.getElementById('clientTRNDisplay').textContent = '';
        }

        // Auto-set VAT Treatment - prefer explicit value from contacts if present
        const vatTreatmentDropdown = document.getElementById('vatTreatmentDropdown');
        if (vatTreatmentDropdown) {
            const vatFromContact = window.selectedClientRow['VAT Treatment'] || window.selectedClientRow['VAT Treatement'] || window.selectedClientRow['VAT Status'] || window.selectedClientRow['Vat Treatment'] || '';
            if (vatFromContact && String(vatFromContact).trim() !== '') {
                // Use the contact's VAT Treatment if explicitly provided (normalize values)
                if (typeof window.normalizeVatTreatment === 'function') {
                    vatTreatmentDropdown.value = window.normalizeVatTreatment(vatFromContact);
                } else {
                    vatTreatmentDropdown.value = vatFromContact;
                }
                // Enable the VAT treatment dropdown when we have a value
                vatTreatmentDropdown.disabled = false;
            } else if (trn && trn.trim() !== "") {
                // Client has TRN = assume VAT Registered
                vatTreatmentDropdown.value = "Vat Registered";
                vatTreatmentDropdown.disabled = false;
            } else {
                // Client has no TRN = VAT Not Registered
                vatTreatmentDropdown.value = "Vat Not Registered";
                vatTreatmentDropdown.disabled = false;
            }
        }

        // Update project code in all relevant fields
        if (document.getElementById('projectCodeInput')) {
            document.getElementById('projectCodeInput').value = clientProjectCode;
        }
        if (document.getElementById('projectCode')) {
            document.getElementById('projectCode').value = clientProjectCode;
        }
        if (document.getElementById('projectCodeDisplay')) {
            document.getElementById('projectCodeDisplay').textContent = clientProjectCode;
        }

        // Update other invoice display fields
        updateInvoiceDisplayFields();

        // Log successful client selection
        console.log(`Client selected successfully: ${clientName}`);

        // Show visual feedback for manual clients
        if (window.selectedClientRow.manually_added) {
            console.log('✅ Manual client selected and applied to invoice');
        }
    }

    // --------- Helper Functions ---------

    function updateInvoiceDisplayFields() {
        if (window.invoiceRenderer && typeof window.invoiceRenderer.updateInvoiceDisplayFields === 'function') {
            return window.invoiceRenderer.updateInvoiceDisplayFields();
        }
        console.warn('invoiceRenderer.updateInvoiceDisplayFields not available');
    }

    // Client data management utilities
    function getClientDataSummary() {
        const clients = window.clientsData || [];
        const manual = clients.filter(c => c.manually_added === true).length;
        const csv = clients.filter(c => !c.manually_added).length;

        return {
            total: clients.length,
            manual: manual,
            csv: csv,
            hasData: clients.length > 0
        };
    }

    // --------- Data Persistence ---------

    function saveClientsToLocalStorage() {
        // Persistence disabled by request — do not write clients to browser storage.
        try {
            console.log('saveClientsToLocalStorage: persistence disabled, skipping write');
        } catch (error) {
            // noop
        }
    }

    // Load clients from localStorage on page load (delegator)
    function loadClientsFromLocalStorage() {
        if (window.dataLoader && typeof window.dataLoader.loadClientsFromLocalStorage === 'function') {
            return window.dataLoader.loadClientsFromLocalStorage();
        }
        console.warn('dataLoader.loadClientsFromLocalStorage missing');
        return false;
    }

    // --------- Refresh and Sync ---------

    function refreshAllClientReferences() {
        // Update main client dropdown
        populateClientDropdown();

        // Update filter dropdown if it exists
        if (typeof window.initializeFilterClientDropdown === 'function') {
            window.initializeFilterClientDropdown();
        }

        // Update upload status
        if (typeof updateUploadStatus === 'function') {
            updateUploadStatus();
        }

        // Enable client form controls if client section is active
        if (window.clientSectionActive && typeof enableClientFormControls === 'function') {
            enableClientFormControls();
        }

        console.log('All client references refreshed');
    }

    // --------- Duplicate Removal ---------

    function removeDuplicateClients() {
        const seen = new Set();
        const uniqueClients = [];

        const clients = window.clientsData || [];
        clients.forEach(client => {
            // use Display Name first when deduplicating
            const name = ((client['Display Name'] || client['Client Name'] || '')).toLowerCase();
            if (name && !seen.has(name)) {
                seen.add(name);
                uniqueClients.push(client);
            }
        });

        const removedCount = (window.clientsData || []).length - uniqueClients.length;
        window.clientsData = uniqueClients;

        if (removedCount > 0) {
            saveClientsToLocalStorage();
            refreshAllClientReferences();
            console.log(`Removed ${removedCount} duplicate clients`);
        }

        return removedCount;
    }

    // --------- Export Functions ---------

    function exportUpdatedClientCSV() {
        const clients = window.clientsData || [];
        if (clients.length === 0) {
            alert('No client data to export.');
            return;
        }

        // Export contacts using preferred column names
        const headers = ['Display Name', 'Billing Address', 'Address Line 2', 'City', 'Country', 'Tax Registration Number', 'Project Code', 'Credit'];
        let csv = headers.join(',') + '\n';

        clients.forEach(client => {
            const row = [
                `"${client['Display Name'] || client['Client Name'] || ''}"`,
                `"${client['Billing Address'] || client['Address Line 1'] || ''}"`,
                `"${client['Address Line 2'] || ''}"`,
                `"${client['City'] || ''}"`,
                `"${client['Country'] || ''}"`,
                `"${client['Tax Registration Number'] || client['TRN Number'] || ''}"`,
                `"${client['Project Code'] || ''}"`,
                `"${client['Credit'] || '0.00'}"`
            ];
            csv += row.join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `client_database_updated_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);

        alert(`📁 Updated client database exported!\n\n📊 File contains ${clients.length} clients\n• Includes "Credit" column\n💾 Download started automatically`);
    }

    // --------- UI Helper Functions ---------

    function showSuccessMessage() {
        // Success popups disabled — this function intentionally does nothing now.
        console.log('showSuccessMessage: disabled');
    }

    // --------- Expose to Window ---------

    window.clientManager = {
        populateClientDropdown: populateClientDropdown,
        selectClient: selectClient,
        getClientDataSummary: getClientDataSummary,
        saveClientsToLocalStorage: saveClientsToLocalStorage,
        loadClientsFromLocalStorage: loadClientsFromLocalStorage,
        refreshAllClientReferences: refreshAllClientReferences,
        removeDuplicateClients: removeDuplicateClients,
        exportUpdatedClientCSV: exportUpdatedClientCSV,
        // Returns the clients visible to the dropdown (after inactive filtering) and sorted by invoice frequency
        getVisibleClientsSortedByInvoiceFrequency: function(){
            // Re-run the sort/filter algorithm used by populateClientDropdown
            const clients = window.clientsData || [];
            const freq = {};
            if (Array.isArray(window.allInvoices)) {
                window.allInvoices.forEach(inv => {
                    const cname = String(inv['Customer Name'] || inv['Client Name'] || '').trim();
                    if (!cname) return;
                    const k = cname.toLowerCase();
                    freq[k] = (freq[k] || 0) + 1;
                });
            }

            const clientRows = clients.map((client, index) => {
                const name = (client['Display Name'] || client['Client Name'] || client['Name'] || client['name'] || client['CLIENT NAME'] || client['client_name'] || '').toString().trim();
                const key = name.toLowerCase();
                const status = ((client['Status']||client['status']||'')+'').toLowerCase().trim();
                const count = freq[key] || 0;
                return { index, name, status, count, raw: client };
            });

            const anyStatusPresent = clients.some(c => (c['Status'] || c['status'] || '').toString().trim() !== '');
            const showInactiveGlobally = (window.settings && typeof window.settings.loadShowInactive === 'function') ? window.settings.loadShowInactive() : (localStorage.getItem('app_settings_showInactiveClients') === '1');

            const visibleRows = clientRows.filter(row => {
                if (!row.name) return false;
                if (anyStatusPresent && !showInactiveGlobally && row.status !== 'active') return false;
                return true;
            });

            visibleRows.sort((a,b)=>{ if (b.count - a.count !== 0) return b.count - a.count; return a.name.localeCompare(b.name); });
            return visibleRows;
        },
        showSuccessMessage: showSuccessMessage
    };

    // Expose critical functions directly to window for HTML event handlers
    window.selectClient = selectClient;
    window.populateClientDropdown = populateClientDropdown;
    window.saveClientsToLocalStorage = saveClientsToLocalStorage;
    window.refreshAllClientReferences = refreshAllClientReferences;

    console.log('✅ Client Manager module loaded');

})();
