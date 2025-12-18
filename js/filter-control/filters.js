// Filters extracted from invoice-control-panel.js
// Exposes `window.filters` and some global helpers (also assigns global names for compatibility)
(function(){
    'use strict';

    // NOTE: This module expects `filterState`, `allInvoices`, `uniqueInvoiceNumbers`,
    // `filteredInvoiceNumbers`, `isFiltered`, `currentInvoiceIndex`, and other app
    // helpers like `showInvoice`, `calculateTotals`, `updateInvoiceNavButtons`,
    // `updateAllInvoicesTable`, `normalizeDateForInput` to be available in the
    // global scope when functions are invoked. It does not run initialization
    // automatically; `initializeEnhancedFilters()` should be called from the main app.

    let invoiceNumberFilterTimeout = null;

    function initializeFilterClientDropdown() {
        const filterDropdown = document.getElementById('filterClientDropdown');

        if (!filterDropdown) {
            console.log("Filter dropdown element not found");
            return;
        }

        // Clear existing options except "All Clients"
        filterDropdown.innerHTML = '<option value="">All Clients</option>';

        // Prefer client list from contacts (window.clientsData) when available
        const uniqueClients = new Set();
        const showInactiveGlobally = (window.settings && typeof window.settings.loadShowInactive === 'function') ? window.settings.loadShowInactive() : (localStorage.getItem('app_settings_showInactiveClients') === '1');

        // Build a name->status map from contacts if available (to optionally filter invoice-derived names)
        const contactStatusMap = {};
        if (Array.isArray(window.clientsData) && window.clientsData.length > 0) {
            window.clientsData.forEach(c => {
                const name = (c['Display Name'] || c['Client Name'] || c['Company Name'] || c['Name'] || '').toString().trim();
                if (!name) return;
                const st = (c['Status'] || c['status'] || '').toString().trim().toLowerCase();
                contactStatusMap[name.toLowerCase()] = st;
            });
        }

        if (Array.isArray(window.clientsData) && window.clientsData.length > 0) {
            // Determine if a Status column exists and filter to active clients when present
            const contacts = window.clientsData;
            const hasStatus = contacts.some(c => (c['Status'] || c['status'] || '').toString().trim() !== '');
            const showInactiveGlobally = (window.settings && typeof window.settings.loadShowInactive === 'function') ? window.settings.loadShowInactive() : (localStorage.getItem('app_settings_showInactiveClients') === '1');
            contacts.forEach(c => {
                const name = (c['Display Name'] || c['Client Name'] || c['Company Name'] || c['Name'] || '').toString().trim();
                if (!name) return;
                if (hasStatus && !showInactiveGlobally) {
                    const st = (c['Status'] || c['status'] || '').toString().trim().toLowerCase();
                    if (st === 'active') uniqueClients.add(name);
                } else {
                    uniqueClients.add(name);
                }
            });
            // If contacts are present but the active filtering removed all names, fall back to invoice-derived names
            if (uniqueClients.size === 0) {
                (allInvoices || []).forEach(invoice => {
                    const clientName = invoice["Customer Name"] || invoice["Client Name"] || invoice["customer_name"] || invoice["client_name"];
                    if (clientName && clientName.trim()) uniqueClients.add(clientName.trim());
                });
            }
        } else {
            // Fallback to deriving unique client names from invoices
            (allInvoices || []).forEach(invoice => {
                const clientName = invoice["Customer Name"] || invoice["Client Name"] || invoice["customer_name"] || invoice["client_name"];
                if (!clientName || !clientName.trim()) return;
                const n = clientName.trim();
                const norm = n.toLowerCase();
                // If contact status map exists and showInactiveGlobally is false, skip clients that are known inactive
                if (!showInactiveGlobally && Object.keys(contactStatusMap).length > 0) {
                    const st = contactStatusMap[norm];
                    if (typeof st === 'string' && st.length > 0 && st !== 'active') return;
                }
                uniqueClients.add(n);
            });
        }

        // Build frequency map from invoices and sort clients by occurrence desc
        const freq = {};
        (allInvoices || []).forEach(inv => {
            const cname = String(inv['Customer Name'] || inv['Client Name'] || '').trim();
            if (!cname) return;
            const k = cname.toLowerCase();
            freq[k] = (freq[k] || 0) + 1;
        });

        const sortedClients = Array.from(uniqueClients).sort((a,b)=>{
            const ca = freq[String(a||'').toLowerCase()] || 0;
            const cb = freq[String(b||'').toLowerCase()] || 0;
            if (cb - ca !== 0) return cb - ca; // most frequent first
            return a.localeCompare(b);
        });

        sortedClients.forEach(clientName => {
            const option = document.createElement('option');
            option.value = clientName;
            const displayName = clientName.length > 35 ? clientName.substring(0, 35) + '...' : clientName;
            option.textContent = displayName;
            option.title = clientName;
            filterDropdown.appendChild(option);
        });

        filterDropdown.disabled = sortedClients.length === 0;

        if (sortedClients.length === 0) {
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "No clients in invoices - load invoices CSV";
            option.disabled = true;
            filterDropdown.appendChild(option);
        }
    }

    function initializeEnhancedFilters() {
        // Set up invoice number filter with real-time search
        const invoiceNumberInput = document.getElementById('filterInvoiceNumber');
        if (invoiceNumberInput) {
            invoiceNumberInput.addEventListener('input', handleInvoiceNumberInput);
            invoiceNumberInput.addEventListener('focus', highlightInvoiceNumberField);
            invoiceNumberInput.addEventListener('blur', unhighlightInvoiceNumberField);
        }

        initializeOtherFilterListeners();
    }

    function handleInvoiceNumberInput(event) {
        const input = event.target;
        const value = input.value.trim();

        // Update filter state (filterState is expected to be declared by main app)
        if (typeof filterState !== 'undefined') filterState.invoiceNumber = value;

        const clearBtn = document.getElementById('clearInvoiceBtn');
        if (value) {
            input.classList.add('has-value');
            if (clearBtn) clearBtn.style.display = 'flex';
        } else {
            input.classList.remove('has-value');
            if (clearBtn) clearBtn.style.display = 'none';
        }

        if (!window.__origActivateClientSection) window.__origActivateClientSection = window.activateClientSection;
        window.activateClientSection = () => {};

        input.classList.add('searching');
        if (invoiceNumberFilterTimeout) clearTimeout(invoiceNumberFilterTimeout);
        invoiceNumberFilterTimeout = setTimeout(() => {
            input.classList.remove('searching');
            applyFiltersEnhanced();
        }, 300);
    }

    function clearInvoiceNumberFilter() {
        const input = document.getElementById('filterInvoiceNumber');
        const clearBtn = document.getElementById('clearInvoiceBtn');

        if (input) {
            input.value = '';
            input.classList.remove('has-value', 'searching');
            if (typeof filterState !== 'undefined') filterState.invoiceNumber = '';
        }
        if (clearBtn) clearBtn.style.display = 'none';
        applyFiltersEnhanced();
    }

    function initializeOtherFilterListeners() {
        const clientFilter = document.getElementById('filterClientDropdown');
        if (clientFilter) {
            clientFilter.addEventListener('change', () => {
                if (typeof filterState !== 'undefined') filterState.client = clientFilter.value;
                applyFiltersEnhanced();
            });
        }

        const dateFromFilter = document.getElementById('filterDateFrom');
        const dateToFilter = document.getElementById('filterDateTo');
        if (dateFromFilter) dateFromFilter.addEventListener('change', () => { if (typeof filterState !== 'undefined') filterState.dateFrom = dateFromFilter.value; applyFiltersEnhanced(); });
        if (dateToFilter) dateToFilter.addEventListener('change', () => { if (typeof filterState !== 'undefined') filterState.dateTo = dateToFilter.value; applyFiltersEnhanced(); });

        const statusFilter = document.getElementById('filterStatusDropdown');
        if (statusFilter) statusFilter.addEventListener('change', () => { if (typeof filterState !== 'undefined') filterState.status = statusFilter.value; applyFiltersEnhanced(); });
    }

    function highlightInvoiceNumberField(event) {
        const container = event.target.parentNode;
        if (container) container.style.boxShadow = '0 0 0 2px rgba(5, 150, 105, 0.1)';
    }
    function unhighlightInvoiceNumberField(event) { const container = event.target.parentNode; if (container) container.style.boxShadow = ''; }

    function normalizeSearchText(s) { return String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim(); }

    function buildAggregateSearchText(invoiceItems) {
        const inv = invoiceItems[0] || {};
        const headerFields = [
            "Invoice Number", "Invoice Date", "Due Date", "Invoice Status", "Place Of Supply",
            "Customer Name", "Client Address", "Client TRN", "Project Code", "Payment Terms",
            "Tax Registration Number", "Notes"
        ];
        const itemFields = ["Item Desc", "Quantity", "Item Price", "Discount", "Taxable Amount", "Item Tax", "Item Tax %"];

        const pieces = [];
        headerFields.forEach(k => pieces.push(inv[k] ?? ''));
        invoiceItems.forEach(row => itemFields.forEach(k => pieces.push(row[k] ?? '')));

        if (inv.currency) pieces.push(inv.currency);
        if (typeof inv.total !== 'undefined') pieces.push(String(inv.total));

        return normalizeSearchText(pieces.join(' | '));
    }

    function invoiceMatchesFreeText(invoiceItems, query) {
        const q = normalizeSearchText(query);
        if (!q) return true;
        const tokens = q.split(' ').filter(Boolean);
        const haystack = buildAggregateSearchText(invoiceItems);
        return tokens.every(tok => haystack.includes(tok));
    }

    function applyFiltersEnhanced() {
        console.log('🔍 applyFiltersEnhanced called');
        console.log('📊 window.allInvoices length:', window.allInvoices ? window.allInvoices.length : 'undefined');
        
        const freeTextFilter = (typeof filterState !== 'undefined' && filterState.invoiceNumber) ? filterState.invoiceNumber : (document.getElementById('filterInvoiceNumber')?.value.trim() || '');
        const clientFilter = (typeof filterState !== 'undefined' && filterState.client) ? filterState.client : (document.getElementById('filterClientDropdown')?.value.trim() || '');
        const dateFromFilter = (typeof filterState !== 'undefined' && filterState.dateFrom) ? filterState.dateFrom : (document.getElementById('filterDateFrom')?.value || '');
        const dateToFilter = (typeof filterState !== 'undefined' && filterState.dateTo) ? filterState.dateTo : (document.getElementById('filterDateTo')?.value || '');
        const statusFilter = (typeof filterState !== 'undefined' && filterState.status) ? filterState.status : (document.getElementById('filterStatusDropdown')?.value || '');

        console.log('🔎 Filters:', { freeTextFilter, clientFilter, dateFromFilter, dateToFilter, statusFilter });

        const allUniqueInvoices = new Set();
        (window.allInvoices || []).forEach(inv => { if (inv["Invoice Number"]) allUniqueInvoices.add(inv["Invoice Number"]); });
        const totalInvoices = allUniqueInvoices.size;
        
        console.log('📋 Total unique invoices:', totalInvoices);

        const filtered = Array.from(allUniqueInvoices).filter(invoiceNo => {
            const invoiceItems = (window.allInvoices || []).filter(item => item["Invoice Number"] === invoiceNo);
            if (invoiceItems.length === 0) return false;
            const header = invoiceItems[0];
            
            if (freeTextFilter && !invoiceMatchesFreeText(invoiceItems, freeTextFilter)) {
                console.log('❌ Invoice', invoiceNo, 'filtered out by text search');
                return false;
            }
            if (clientFilter) { 
                const customerName = (header["Customer Name"] || "").trim(); 
                if (customerName.toLowerCase() !== clientFilter.toLowerCase()) {
                    console.log('❌ Invoice', invoiceNo, 'filtered out by client:', customerName, '!==', clientFilter);
                    return false;
                }
            }
            if (dateFromFilter || dateToFilter) {
                const invISO = (typeof normalizeDateForInput === 'function') ? normalizeDateForInput(header["Invoice Date"]) : header["Invoice Date"];
                if (!invISO) return false;
                const invDate = new Date(invISO);
                if (isNaN(invDate.getTime())) return false;
                if (dateFromFilter) { const fromDate = new Date(dateFromFilter); if (invDate < fromDate) return false; }
                if (dateToFilter) { const toDate = new Date(dateToFilter); if (invDate > toDate) return false; }
            }
            if (statusFilter) { 
                const invoiceStatus = (header["Invoice Status"] || "").trim(); 
                if (invoiceStatus !== statusFilter) {
                    console.log('❌ Invoice', invoiceNo, 'filtered out by status:', invoiceStatus, '!==', statusFilter);
                    return false;
                }
            }
            return true;
        });

        console.log('✅ Filtered invoices:', filtered.length, 'out of', totalInvoices);

        window.filteredInvoiceNumbers = filtered;
        filteredInvoiceNumbers = filtered;
        window.isFiltered = filtered.length < totalInvoices;
        isFiltered = filtered.length < totalInvoices;

        if (typeof filterState !== 'undefined') {
            filterState.lastResults = {
                total: totalInvoices,
                filtered: filtered.length,
                breakdown: {
                    search: freeTextFilter ? `Text contains "${freeTextFilter}"` : null,
                    client: clientFilter ? `Client: ${clientFilter}` : null,
                    dateRange: (dateFromFilter || dateToFilter) ? `Date: ${dateFromFilter || 'Any'} to ${dateToFilter || 'Any'}` : null,
                    status: statusFilter ? `Status: ${statusFilter}` : null
                }
            };
        }

        updateEnhancedFilterResults(filtered.length, totalInvoices);

        if (filtered.length > 0) {
            currentInvoiceIndex = 0;
            if (typeof showInvoice === 'function') showInvoice(0);
        } else {
            const invNumEl = document.getElementById('invoiceNumber'); if (invNumEl) invNumEl.value = "";
            const clientNameEl = document.getElementById('clientNameDisplay'); if (clientNameEl) clientNameEl.textContent = "No invoices match filters";
            const itemsTable = document.getElementById('itemsTable'); if (itemsTable) itemsTable.innerHTML = "";
            if (typeof calculateTotals === 'function') calculateTotals();
        }

        if (typeof updateInvoiceNavButtons === 'function') updateInvoiceNavButtons();
    }

    function updateEnhancedFilterResults(filteredCount, totalCount) {
        const resultsSpan = document.getElementById('filterResults');
        const resultsContainer = document.querySelector('.filter-results-container');
        const resultsDetailed = document.getElementById('filterResultsDetailed');
        if (!resultsSpan) return;
        if (resultsContainer) { resultsContainer.classList.add('updating'); setTimeout(() => resultsContainer.classList.remove('updating'), 600); }

        let state = 'neutral';
        let mainMessage = '';
        let detailedMessage = '';

        if (filteredCount === 0) {
            state = 'error';
            mainMessage = '❌ No invoices match current filters';
            detailedMessage = 'Try adjusting your filter criteria or clearing some filters.';
            resultsSpan.className = "filter-results-error";
        } else if (filteredCount === totalCount) {
            state = 'neutral';
            mainMessage = `📋 Showing all ${totalCount} invoices`;
            detailedMessage = 'No filters applied - displaying complete invoice list.';
            resultsSpan.className = "filter-results-neutral";
        } else {
            state = 'success';
            const percentage = Math.round((filteredCount / totalCount) * 100);
            mainMessage = `🔍 Found ${filteredCount} of ${totalCount} invoices (${percentage}%)`;
            resultsSpan.className = "filter-results-success";
            const activeFilters = [];
            if (filterState && filterState.lastResults && filterState.lastResults.breakdown) {
                Object.entries(filterState.lastResults.breakdown).forEach(([key, value]) => { if (value) activeFilters.push(value); });
            }
            if (activeFilters.length > 0) detailedMessage = `Active filters: ${activeFilters.join(' • ')}`; else detailedMessage = 'Partial filters applied.';
        }

        resultsSpan.textContent = mainMessage;
        if (resultsDetailed) resultsDetailed.textContent = detailedMessage;
        if (resultsContainer) resultsContainer.className = `filter-results-container ${state}`;
    }

    function clearFilters() {
        if (window.__origActivateClientSection) window.activateClientSection = window.__origActivateClientSection;
        
        // Get the invoice number from BEFORE filters were applied
        const preFilterInvoiceNumber = window.__preFilterInvoiceNumber || null;
        
        console.log('🧹 Clearing filters, restoring to pre-filter invoice:', preFilterInvoiceNumber);
        
        const filterInputs = ['filterInvoiceNumber','filterClientDropdown','filterDateFrom','filterDateTo','filterStatusDropdown'];
        filterInputs.forEach(inputId => { const el = document.getElementById(inputId); if (el) el.value = ''; });
        
        // Clear date preset dropdown
        const datePresetDropdown = document.getElementById('datePresetDropdown');
        if (datePresetDropdown) datePresetDropdown.value = '';
        
        const invoiceNumberInput = document.getElementById('filterInvoiceNumber');
        const clearBtn = document.getElementById('clearInvoiceBtn');
        if (invoiceNumberInput) invoiceNumberInput.classList.remove('has-value','searching');
        if (clearBtn) clearBtn.style.display = 'none';
        if (typeof filterState !== 'undefined') {
            filterState = { invoiceNumber: '', client: '', dateFrom: '', dateTo: '', status: '', lastResults: { total:0, filtered:0, breakdown:{} } };
        }
        window.filteredInvoiceNumbers = [];
        window.isFiltered = false;
        const totalInvoices = [...new Set((window.allInvoices||[]).map(inv => inv["Invoice Number"]))].length;
        updateEnhancedFilterResults(totalInvoices, totalInvoices);
        if (typeof updateUniqueInvoiceNumbers === 'function') updateUniqueInvoiceNumbers();
        
        // Restore the invoice position to pre-filter state
        if (preFilterInvoiceNumber && window.uniqueInvoiceNumbers && window.uniqueInvoiceNumbers.length > 0) {
            const restoredIndex = window.uniqueInvoiceNumbers.indexOf(preFilterInvoiceNumber);
            console.log('🔍 Looking for pre-filter invoice', preFilterInvoiceNumber, 'found at index:', restoredIndex);
            if (restoredIndex !== -1) {
                window.currentInvoiceIndex = restoredIndex;
                console.log('✅ Restoring to pre-filter index:', restoredIndex);
                if (typeof showInvoice === 'function') showInvoice(restoredIndex);
            } else {
                console.log('❌ Pre-filter invoice not found, going to first');
                window.currentInvoiceIndex = 0;
                if (typeof showInvoice === 'function') showInvoice(0);
            }
        } else if (window.uniqueInvoiceNumbers && window.uniqueInvoiceNumbers.length > 0) {
            console.log('⚠️ No pre-filter invoice saved, going to first');
            window.currentInvoiceIndex = 0;
            if (typeof showInvoice === 'function') showInvoice(0);
        }
        
        // Clear the saved pre-filter invoice
        window.__preFilterInvoiceNumber = null;
        
        if (typeof updateInvoiceNavButtons === 'function') updateInvoiceNavButtons();
    }

    function applyFilters() {
        if (!window.__origActivateClientSection) {
            window.__origActivateClientSection = window.activateClientSection;
        }
        window.activateClientSection = () => {};
        
        // Save the current invoice BEFORE applying filter (only if not already filtered)
        if (!window.isFiltered && window.uniqueInvoiceNumbers && window.uniqueInvoiceNumbers.length > 0 && window.currentInvoiceIndex >= 0) {
            window.__preFilterInvoiceNumber = window.uniqueInvoiceNumbers[window.currentInvoiceIndex];
            console.log('💾 Saving pre-filter invoice:', window.__preFilterInvoiceNumber, 'at index:', window.currentInvoiceIndex);
        }
        
        if (typeof filterState !== 'undefined') {
            filterState.invoiceNumber = document.getElementById('filterInvoiceNumber')?.value.trim() || '';
            filterState.client = document.getElementById('filterClientDropdown')?.value.trim() || '';
            filterState.dateFrom = document.getElementById('filterDateFrom')?.value || '';
            filterState.dateTo = document.getElementById('filterDateTo')?.value || '';
            filterState.status = document.getElementById('filterStatusDropdown')?.value || '';
        }
        
        applyFiltersEnhanced();
    }

    function debugFilterDropdown() { initializeFilterClientDropdown(); }
    function refreshFilterDropdown() { initializeFilterClientDropdown(); }

    // Expose API
    const api = {
        initializeFilterClientDropdown,
        initializeEnhancedFilters,
        handleInvoiceNumberInput,
        clearInvoiceNumberFilter,
        initializeOtherFilterListeners,
        highlightInvoiceNumberField,
        unhighlightInvoiceNumberField,
        normalizeSearchText,
        buildAggregateSearchText,
        invoiceMatchesFreeText,
        applyFiltersEnhanced,
        updateEnhancedFilterResults,
        clearFilters,
        applyFilters,
        debugFilterDropdown,
        refreshFilterDropdown
    };

    window.filters = api;
    // Also set named globals for compatibility with existing calls
    window.initializeEnhancedFilters = initializeEnhancedFilters;
    window.applyFiltersEnhanced = applyFiltersEnhanced;
    window.updateEnhancedFilterResults = updateEnhancedFilterResults;
    window.handleInvoiceNumberInput = handleInvoiceNumberInput;
    window.clearInvoiceNumberFilter = clearInvoiceNumberFilter;

})();
