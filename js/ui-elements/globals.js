// ===============================
// Global Variables and Initial Functions
// This module initializes all global data structures and helper functions
// used across the invoice management system
// ===============================

(function() {
    'use strict';

    // ========== GLOBAL DATA CONTAINERS ==========
    
    // Core invoice and client data
    window.allInvoices = window.allInvoices || [];
    window.clientsData = window.clientsData || [];
    window.paymentsData = window.paymentsData || [];
    
    // Invoice tracking
    window.uniqueInvoiceNumbers = window.uniqueInvoiceNumbers || [];
    window.currentInvoiceIndex = (typeof window.currentInvoiceIndex === 'number') ? window.currentInvoiceIndex : -1;
    
    // Filter tracking
    window.filteredInvoiceNumbers = window.filteredInvoiceNumbers || [];
    window.isFiltered = window.isFiltered || false;
    
    // Filter state object
    window.filterState = {
        invoiceNumber: '',
        client: '',
        dateFrom: '',
        dateTo: '',
        status: '',
        lastResults: {
            total: 0,
            filtered: 0,
            breakdown: {}
        }
    };
    
    // UI state
    window.clientSectionActive = window.clientSectionActive || false;
    window.invoiceFileUploaded = window.invoiceFileUploaded || false;
    window.isNewInvoiceMode = window.isNewInvoiceMode || false;  // Track if creating new invoice vs viewing existing
    window.stickToLatest = window.stickToLatest || false; // When true, keep navigation anchored to latest invoice

    // ========== CORE UTILITY FUNCTIONS ==========
    
    /**
     * Updates the unique invoice numbers array from allInvoices
     * Ensures currentInvoiceIndex remains valid
     */
    window.updateUniqueInvoiceNumbers = function() {
        try {
            // Ensure local references are in sync with window globals
            if (typeof window.syncGlobalArrays === 'function') window.syncGlobalArrays();

            // Build set of unique invoice numbers preserving insertion order
            const set = new Set();
            (window.allInvoices || []).forEach(inv => {
                const num = inv && (inv["Invoice Number"] || inv["Invoice No"] || inv.invoiceNumber);
                if (num) set.add(String(num));
            });

            const arr = Array.from(set);
            window.uniqueInvoiceNumbers.length = 0;
            arr.forEach(n => window.uniqueInvoiceNumbers.push(n));

            // Ensure current index remains valid and respect stickToLatest preference
            if (window.currentInvoiceIndex < 0 || window.currentInvoiceIndex >= window.uniqueInvoiceNumbers.length) {
                if (window.stickToLatest && window.uniqueInvoiceNumbers.length > 0) {
                    window.currentInvoiceIndex = window.uniqueInvoiceNumbers.length - 1;
                } else {
                    window.currentInvoiceIndex = window.uniqueInvoiceNumbers.length > 0 ? 0 : -1;
                }
            }
        } catch (err) {
            console.error('updateUniqueInvoiceNumbers error', err);
        }
    };

    /**
     * Synchronizes local and window global arrays
     * Call this when external modules update global data
     */
    window.syncGlobalArrays = function() {
        try {
            // This function is primarily used by modules to ensure they're working
            // with the latest global data. Since we're now managing everything via
            // window globals, this mostly serves as a compatibility layer.
           // console.log('syncGlobalArrays called - globals are synchronized');
        } catch (e) {
            console.error('syncGlobalArrays error', e);
        }
    };

    /**
     * Global number formatting helper
     * @param {number|string} n - Number to format
     * @returns {string} Formatted number with commas and 2 decimal places
     */
    window.formatNumber = function(n) {
        const num = Number(n || 0);
        if (isNaN(num)) return '0.00';
        return num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    };

    /**
     * Normalize VAT treatment values from various sources into the UI dropdown values.
     * Accepts variants like 'vat_registered', 'vat_not_registered', 'non_gcc', 'Vat Registered', etc.
     * Returns canonical dropdown string (e.g. 'Vat Registered', 'Vat Not Registered', 'Non GCC', or '')
     */
    window.normalizeVatTreatment = function(value) {
        if (value === undefined || value === null) return '';
        let s = String(value).trim().toLowerCase().replace(/[_\s]+/g, ' ');

        // Known canonical mappings
        if (s === 'vat registered' || s === 'vat_registered' || s === 'vatregistered' || s === 'registered' || s === 'yes') return 'Vat Registered';
        if (s === 'vat not registered' || s === 'vat_not_registered' || s === 'vatnotregistered' || s === 'not registered' || s === 'no') return 'Vat Not Registered';
        if (s === 'non gcc' || s === 'non_gcc' || s === 'non-gcc') return 'Non Gcc';

        // fallback: Title case the value (replace underscores / hyphens)
        const words = s.split(/[^a-z0-9]+/).filter(Boolean);
        if (words.length === 0) return '';
        return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    };

    /**
     * Normalize search text for filtering
     * @param {string} s - Text to normalize
     * @returns {string} Normalized lowercase text
     */
    window.normalizeSearchText = function(s) {
        return String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
    };

    // ========== CLIENT SECTION MANAGEMENT ==========
    
    /**
     * Activates the client section in the UI
     */
    window.activateClientSection = function() {
        try {
            window.clientSectionActive = true;
            const content = document.getElementById('clientSectionContent');
            const icon = document.getElementById('clientSectionIcon');
            const status = document.getElementById('clientSectionStatus');
            if (content) content.classList.remove('collapsed');
            if (icon) icon.textContent = '▼';
            if (status) status.textContent = '';
            const dropdown = document.getElementById('clientDropdown');
            if (dropdown) dropdown.disabled = false;
            if (typeof window.enableClientFormControls === 'function') window.enableClientFormControls();
        } catch (err) { 
            console.error('activateClientSection error', err); 
        }
    };

    /**
     * Deactivates the client section in the UI
     */
    window.deactivateClientSection = function() {
        try {
            window.clientSectionActive = false;
            const content = document.getElementById('clientSectionContent');
            const icon = document.getElementById('clientSectionIcon');
            const status = document.getElementById('clientSectionStatus');
            if (content) content.classList.add('collapsed');
            if (icon) icon.textContent = '▶';
            if (status) status.textContent = '(Click to expand)';
            const dropdown = document.getElementById('clientDropdown');
            if (dropdown) dropdown.disabled = true;
            if (typeof window.disableClientFormControls === 'function') window.disableClientFormControls();
        } catch (err) { 
            console.error('deactivateClientSection error', err); 
        }
    };

    /**
     * Toggles the client section visibility
     */
    window.toggleClientSection = function() {
        const content = document.getElementById('clientSectionContent');
        const icon = document.getElementById('clientSectionIcon');
        
        if (content && icon) {
            const isCollapsed = content.classList.contains('collapsed');
            
            if (isCollapsed) {
                // Expand
                content.classList.remove('collapsed');
                icon.textContent = '▼';
            } else {
                // Collapse
                content.classList.add('collapsed');
                icon.textContent = '▶';
            }
        }
    };

    // ========== FILTER DELEGATOR FUNCTIONS ==========
    // These delegate to the filters module when available
    
    window.initializeFilterClientDropdown = function() { 
        if (window.filters && typeof window.filters.initializeFilterClientDropdown === 'function') 
            return window.filters.initializeFilterClientDropdown(); 
        console.warn('filters.initializeFilterClientDropdown missing'); 
    };
    
    window.initializeEnhancedFilters = function() { 
        if (window.filters && typeof window.filters.initializeEnhancedFilters === 'function') 
            return window.filters.initializeEnhancedFilters(); 
        console.warn('filters.initializeEnhancedFilters missing'); 
    };
    
    window.handleInvoiceNumberInput = function(e) { 
        if (window.filters && typeof window.filters.handleInvoiceNumberInput === 'function') 
            return window.filters.handleInvoiceNumberInput(e); 
        console.warn('filters.handleInvoiceNumberInput missing'); 
    };
    
    window.clearInvoiceNumberFilter = function() { 
        if (window.filters && typeof window.filters.clearInvoiceNumberFilter === 'function') 
            return window.filters.clearInvoiceNumberFilter(); 
        console.warn('filters.clearInvoiceNumberFilter missing'); 
    };
    
    window.applyFiltersEnhanced = function() { 
        if (window.filters && typeof window.filters.applyFiltersEnhanced === 'function') 
            return window.filters.applyFiltersEnhanced(); 
        console.warn('filters.applyFiltersEnhanced missing'); 
    };
    
    window.updateEnhancedFilterResults = function(a,b) { 
        if (window.filters && typeof window.filters.updateEnhancedFilterResults === 'function') 
            return window.filters.updateEnhancedFilterResults(a,b); 
        console.warn('filters.updateEnhancedFilterResults missing'); 
    };
    
    window.clearFilters = function() { 
        if (window.filters && typeof window.filters.clearFilters === 'function') 
            return window.filters.clearFilters(); 
        console.warn('filters.clearFilters missing'); 
    };
    
    window.applyFilters = function() { 
        if (window.filters && typeof window.filters.applyFilters === 'function') 
            return window.filters.applyFilters(); 
        console.warn('filters.applyFilters missing'); 
    };

    // ========== STORAGE MANAGEMENT ==========
    
    /**
     * Clear browser storage (localStorage and sessionStorage)
     */
    window.clearBrowserStorage = function() {
        try {
                    // Preserve important user preferences and credentials before clearing
            const PRESERVE_KEYS = [
                'invoiceApp_autoLoadData'//,
                //'app_settings_showInactiveClients',
             //   'invoiceApp_google_apiKey',
                //'invoiceApp_google_clientId',
               // 'invoiceApp_google_spreadsheetId'
            ];
            const backup = {};
            try {
                if (typeof localStorage !== 'undefined') {
                    PRESERVE_KEYS.forEach(k => {
                        const v = localStorage.getItem(k);
                        if (v !== null) backup[k] = v;
                    });
                    localStorage.clear();
                    // restore preserved keys
                    Object.keys(backup).forEach(k => localStorage.setItem(k, backup[k]));
                    console.log('✅ localStorage cleared (preserved settings restored)');
                }
            } catch (e) {
                console.error('Error clearing localStorage while preserving keys:', e);
            }

            // Clear sessionStorage (no preservation by default)
            try {
                if (typeof sessionStorage !== 'undefined') {
                    sessionStorage.clear();
                    console.log('✅ sessionStorage cleared');
                }
            } catch (e) {
                console.error('Error clearing sessionStorage:', e);
            }
        } catch (e) {
            console.error('Error clearing browser storage:', e);
        }
    };

    /**
     * Setup automatic storage clearing on page unload
     */
    window.setupStorageClearOnUnload = function() {
        window.addEventListener('beforeunload', function(e) {
            // Clear browser storage when page is about to close or reload
            window.clearBrowserStorage();
        });
        console.log('✅ Storage clear on unload configured');
    };

    // ========== KEYBOARD SHORTCUTS ==========
    
    /**
     * Global keyboard shortcut handler
     */
    document.addEventListener('keydown', function(e) {
        // CTRL+B: Open Bundle Manager
        if (e.ctrlKey && e.key.toLowerCase() === 'b') {
            e.preventDefault();
            if (typeof window.openAddBundleModal === 'function') {
                window.openAddBundleModal();
            } else {
                console.warn('Bundle modal function not available');
            }
            return;
        }
        
        // CTRL+R: Open Reports Modal
        if (e.ctrlKey && e.key.toLowerCase() === 'r') {
            e.preventDefault();
            if (typeof window.openReportsModal === 'function') {
                window.openReportsModal();
            } else {
                console.warn('Reports modal function not available');
            }
            return;
        }
    });

    // ========== INITIALIZATION ==========
    
    // Enable automatic storage clearing on page close/reload
    window.setupStorageClearOnUnload();
    
    console.log('✅ Global variables and functions initialized');
    
})();
