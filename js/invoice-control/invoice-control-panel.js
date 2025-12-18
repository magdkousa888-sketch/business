
        // ===============================
        // Invoice Generator JS (Fixed Table Mapping)
        // NOTE: Global variables and core functions are now in js/globals.js
        // This file contains the main application logic and UI handlers
        // ===============================

        // Create local references to window globals for convenience
        let allInvoices = window.allInvoices;
        let clientsData = window.clientsData;
        let uniqueInvoiceNumbers = window.uniqueInvoiceNumbers;
        let currentInvoiceIndex = window.currentInvoiceIndex;
        let filteredInvoiceNumbers = window.filteredInvoiceNumbers;
        let isFiltered = window.isFiltered;
        let filterState = window.filterState;
        let clientSectionActive = window.clientSectionActive;

        // Debounced invoice number filter (kept here so timeouts survive across calls)
        let invoiceNumberFilterTimeout = null;

        // Upload section tracking variables
        let csvFileUploaded = false;
        let invoiceFileUploaded = false;
        let uploadSectionCollapsed = false;

        // NOTE: All filter functions and utilities are now in globals.js and filters.js
        // Use window.functionName directly to avoid infinite recursion
        // Removed all local delegator functions
        
        // Note: These utility functions are defined in globals.js - use window.functionName directly
        // Removed local delegators to prevent infinite recursion

        function toggleClientSection() {
            const content = document.getElementById('clientSectionContent');
            if (!content) return;
            if (content.classList.contains('collapsed')) activateClientSection(); else deactivateClientSection();
        }

        function toggleUploadSection() {
            const content = document.getElementById('uploadSectionContent');
            const icon = document.getElementById('uploadSectionIcon');
            
            if (!content) return;
            
            if (content.style.display === 'none') {
                content.style.display = 'block';
                if (icon) icon.textContent = '▼';
                uploadSectionCollapsed = false;
            } else {
                content.style.display = 'none';
                if (icon) icon.textContent = '▶';
                uploadSectionCollapsed = true;
            }
        }

        function enableClientFormControls() {
            try {
                const container = document.getElementById('clientSectionContent');
                if (!container) return;
                const controls = container.querySelectorAll('input, select, textarea, button');
                controls.forEach(c => { c.disabled = false; });
            } catch (err) { console.error('enableClientFormControls error', err); }
        }

        function disableClientFormControls() {
            try {
                const container = document.getElementById('clientSectionContent');
                if (!container) return;
                const controls = container.querySelectorAll('input, select, textarea, button');
                controls.forEach(c => { c.disabled = true; });
            } catch (err) { console.error('disableClientFormControls error', err); }
        }

        // Backwards-compatible handler used by the HTML file input for clients CSV
        function handleCSVUpload(event) {
            if (window.dataLoader && typeof window.dataLoader.loadClientsCSV === 'function') return window.dataLoader.loadClientsCSV(event);
            console.warn('dataLoader.loadClientsCSV missing - no client CSV loader available');
        }

        // (Removed duplicate top-level Papa.parse block here — handled by `handleCSVUpload` lower in the file)

        function loadInvoicesCSV(event) {
            if (window.dataLoader && typeof window.dataLoader.loadInvoicesCSV === 'function') return window.dataLoader.loadInvoicesCSV(event);
            console.warn('dataLoader.loadInvoicesCSV missing');
        }

        // Helper: delegate to dataLoader
        function findLastInvoiceByReference() {
            if (window.dataLoader && typeof window.dataLoader.findLastInvoiceByReference === 'function') return window.dataLoader.findLastInvoiceByReference();
            console.warn('dataLoader.findLastInvoiceByReference missing');
            return null;
        }

        function parseInvoiceReference(ref) {
            if (window.dataLoader && typeof window.dataLoader.parseInvoiceReference === 'function') return window.dataLoader.parseInvoiceReference(ref);
            console.warn('dataLoader.parseInvoiceReference missing');
            return { prefix: "", num: 0, pad: 1, suffix: "", original: ref };
        }

        // Auto-load feedback functions moved to ui_feedback.js

        // --------- Invoice Functions ---------

        // If an external save implementation exists (extracted to js/save_invoice.js),
        // set this flag so local copies in this file won't override it.
        window._save_current_implementation_exists = (typeof window.saveCurrentInvoice === 'function');

        function addNewInvoice() {
            if (typeof window.addNewInvoiceImpl === 'function') {
                return window.addNewInvoiceImpl();
            }
            console.warn('addNewInvoiceImpl not available - ensure js/add_new_invoice.js is loaded');
        }

                function showInvoice(idx) {
                        if (window.invoiceRenderer && typeof window.invoiceRenderer.showInvoice === 'function') return window.invoiceRenderer.showInvoice(idx);
                        console.warn('invoiceRenderer.showInvoice not available');
                }


        // Normalize many common date formats (e.g., 04/09/2025) to YYYY-MM-DD for <input type="date">
        function normalizeDateForInput(d) {
            const s = String(d || '').trim();
            if (!s) return '';
            // Already ISO
            if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
            // Handle d/m/yyyy or dd/mm/yyyy (or with -)
            const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
            if (m) {
                const dd = m[1].padStart(2, '0');
                const mm = m[2].padStart(2, '0');
                const yyyy = m[3];
                return `${yyyy}-${mm}-${dd}`;
            }
            // Last resort: Date.parse (may be locale-dependent)
            const parsed = new Date(s);
            if (!isNaN(parsed)) return parsed.toISOString().slice(0, 10);
            return '';
        }



        // Helper function to clear invoice display (delegator to invoice_renderer)
        function clearInvoiceDisplay() {
            if (window.invoiceRenderer && typeof window.invoiceRenderer.clearInvoiceDisplay === 'function') return window.invoiceRenderer.clearInvoiceDisplay();
            console.warn('invoiceRenderer.clearInvoiceDisplay not available');
        }

        // --------- Continue with remaining functions... ---------

        function updateInvoiceNavButtons() {
            if (window.navigation && typeof window.navigation.updateInvoiceNavButtons === 'function') return window.navigation.updateInvoiceNavButtons();
            // fallback
            try { if (typeof window.updateUniqueInvoiceNumbers === 'function') window.updateUniqueInvoiceNumbers(); } catch (e) {}
            const prev = document.getElementById('prevInvBtn');
            const next = document.getElementById('nextInvBtn');
            if (!prev || !next) return;
            const idx = (typeof window.currentInvoiceIndex === 'number') ? window.currentInvoiceIndex : 0;
            const arr = Array.isArray(window.uniqueInvoiceNumbers) ? window.uniqueInvoiceNumbers : [];
            prev.disabled = !(idx > 0);
            next.disabled = !(idx < arr.length - 1);
        }

        function showPrevInvoice() {
            if (window.navigation && typeof window.navigation.showPrevInvoice === 'function') return window.navigation.showPrevInvoice();
            // fallback
            if (typeof window.syncGlobalArrays === 'function') window.syncGlobalArrays();
            if (Array.isArray(window.uniqueInvoiceNumbers) && window.uniqueInvoiceNumbers.length > 0 && typeof window.currentInvoiceIndex === 'number' && window.currentInvoiceIndex > 0) {
                window.currentInvoiceIndex -= 1;
                // When user navigates manually, stop anchoring to latest invoice
                window.stickToLatest = false;
                if (typeof window.showInvoice === 'function') window.showInvoice(window.currentInvoiceIndex);
                if (typeof window.updateInvoiceNavButtons === 'function') window.updateInvoiceNavButtons();
            }
        }

        function showNextInvoice() {
            if (window.navigation && typeof window.navigation.showNextInvoice === 'function') return window.navigation.showNextInvoice();
            // fallback
            if (typeof window.syncGlobalArrays === 'function') window.syncGlobalArrays();
            if (Array.isArray(window.uniqueInvoiceNumbers) && window.uniqueInvoiceNumbers.length > 0 && typeof window.currentInvoiceIndex === 'number' && window.currentInvoiceIndex < window.uniqueInvoiceNumbers.length - 1) {
                window.currentInvoiceIndex += 1;
                // When user navigates manually, stop anchoring to latest invoice
                window.stickToLatest = false;
                if (typeof window.showInvoice === 'function') window.showInvoice(window.currentInvoiceIndex);
                if (typeof window.updateInvoiceNavButtons === 'function') window.updateInvoiceNavButtons();
            }
        }

        function afterDatabaseUpdate() {
            console.log('Updating database references...');

            // Initialize filter dropdown if we have invoices
            if (allInvoices && allInvoices.length > 0) {
                if (typeof window.initializeFilterClientDropdown === 'function') window.initializeFilterClientDropdown();
            }

            // Update unique invoice numbers from table data
            if (typeof window.updateUniqueInvoiceNumbers === 'function') window.updateUniqueInvoiceNumbers();

            // Update navigation buttons based on table data
            updateInvoiceNavButtons();

            // Only auto-show invoice if we have invoices in the table
            if (uniqueInvoiceNumbers.length > 0) {
                // Ensure current index is valid
                if (window.stickToLatest) {
                    // User recently cloned — keep them anchored to the latest invoice
                    currentInvoiceIndex = uniqueInvoiceNumbers.length - 1;
                } else if (currentInvoiceIndex < 0 || currentInvoiceIndex >= uniqueInvoiceNumbers.length) {
                    currentInvoiceIndex = 0;
                }
                showInvoice(currentInvoiceIndex);
            } else {
                // No invoices in table - clear display and disable navigation
                console.log('No invoices in table - navigation disabled');
                currentInvoiceIndex = -1;
                clearInvoiceDisplay();
            }

            console.log(`Database updated - ${uniqueInvoiceNumbers.length} invoices available`);
        }

        // --------- Table and other functions continue... ---------

        // Delegated save handler — prefer external implementation in js/save_invoice.js
        // If external implementation not available, a minimal fallback stub is kept above.

        // Add these missing functions to your JavaScript section

        // saveInvoiceData: storage responsibilities have been intentionally removed from
        // the control panel. This function now delegates to the global implementation
        // (which should live in js/save_invoice.js). If not present, callers will get
        // a harmless message and a false return value.
        function saveInvoiceData(invoiceNumber, validItems, invoiceDataObj, isNewInvoice) {
            if (typeof window.saveInvoiceData === 'function' && window.saveInvoiceData !== saveInvoiceData) {
                try { return window.saveInvoiceData(invoiceNumber, validItems, invoiceDataObj, isNewInvoice); } catch (e) { console.warn('saveInvoiceData delegate failed', e); return false; }
            }
            console.warn('saveInvoiceData delegate not present — control-panel will use local in-memory fallback');

            // Minimal in-control fallback so Save still works when a global delegate
            // isn't available. This avoids blocking UI flows and keeps behavior safe.
            try {
                if (!invoiceNumber) return false;
                window.allInvoices = window.allInvoices || [];

                const rows = [];
                // DOM rows -> canonical object
                if (Array.isArray(validItems) && validItems.length > 0 && validItems[0] && validItems[0].querySelector) {
                    validItems.forEach(r => {
                        const desc = r.querySelector('.desc-input') ? (r.querySelector('.desc-input').value || '').trim() : '';
                        const qty = r.querySelector('.qty-input') ? (r.querySelector('.qty-input').value || '').trim() : '';
                        const rate = r.querySelector('.rate-input') ? (r.querySelector('.rate-input').value || '').trim() : '';
                        const discount = r.querySelector('.discount-input') ? (r.querySelector('.discount-input').value || '').trim() : '0';
                        const taxPercent = r.querySelector('.tax-percent-input') ? (r.querySelector('.tax-percent-input').value || '').trim() : '';
                        const taxableEl = r.querySelector('.taxable-amount');
                        const taxable = taxableEl ? ((taxableEl.textContent || '').replace(/\u00A0/g,' ').replace(/,/g,'')) : '';
                        const taxEl = r.querySelector('.tax-amount');
                        const taxAmt = taxEl ? ((taxEl.textContent || '').replace(/\u00A0/g,' ').replace(/,/g,'')) : '';

                        rows.push(Object.assign({}, invoiceDataObj || {}, {
                            'Invoice Number': invoiceNumber,
                            'Item Desc': desc,
                            'Quantity': qty || '1',
                            'Item Price': rate || '',
                            'Discount': discount || '0',
                            'Taxable Amount': taxable || '',
                            'Item Tax Amount': taxAmt || '',
                            'Item Tax %': taxPercent || '',
                            'Invoice Date': invoiceDataObj && invoiceDataObj.invoiceDate ? invoiceDataObj.invoiceDate : '',
                            'Place Of Supply': invoiceDataObj && invoiceDataObj.emirate ? invoiceDataObj.emirate : '',
                            'VAT Treatment': invoiceDataObj && invoiceDataObj.vatTreatment ? invoiceDataObj.vatTreatment : ''
                        }));
                    });
                } else if (Array.isArray(validItems) && validItems.length > 0) {
                    validItems.forEach(r => {
                        const row = Object.assign({}, invoiceDataObj || {}, r);
                        row['Invoice Number'] = invoiceNumber;
                        rows.push(row);
                    });
                }

                if (rows.length === 0) return false;

                window.allInvoices.push(...rows);

                if (typeof window.updateUniqueInvoiceNumbers === 'function') window.updateUniqueInvoiceNumbers();
                if (typeof window.updateInvoiceNavButtons === 'function') window.updateInvoiceNavButtons();

                // Persist to storage manager if present (best-effort)
                if (typeof window.invoiceStorageManager === 'object' && typeof window.invoiceStorageManager.saveInvoicesToStorage === 'function') {
                    try { window.invoiceStorageManager.saveInvoicesToStorage(); } catch (e) { console.warn('control-panel fallback: storage save failed', e); }
                }

                return true;
            } catch (err) {
                console.error('control-panel save fallback failed', err);
                return false;
            }
        }



        // Centralized post-save actions
        function postSaveActions(invoiceNumber, customerName, itemCount, isUpdating, isNewInvoice) {
            // Clear the unsaved cloned invoice flag after successful save
            if (window.hasUnsavedClonedInvoice) {
                window.hasUnsavedClonedInvoice = false;
            }
            
            // Update displays and refresh data (global table rendering removed)
            if (typeof window.initializeFilterClientDropdown === 'function') window.initializeFilterClientDropdown();
            afterDatabaseUpdate();

            // Set current invoice index to the newly saved invoice
            if (typeof window.updateUniqueInvoiceNumbers === 'function') window.updateUniqueInvoiceNumbers();
            const savedInvoiceIndex = uniqueInvoiceNumbers.indexOf(invoiceNumber);
            if (savedInvoiceIndex !== -1) {
                currentInvoiceIndex = savedInvoiceIndex;
                updateInvoiceNavButtons();
            }

            // Clear visual highlights
            clearFieldHighlights();

            // Show success message
            const actionText = isUpdating ? "updated" : "saved";
            const actionIcon = isUpdating ? "🔄" : "✅";
            const storageInfo = invoiceStorageManager ? invoiceStorageManager.getStorageStats() : null;

            let successMessage = `${actionIcon} Invoice ${invoiceNumber} ${actionText} successfully!\n\n`;
            successMessage += `📊 Summary:\n• ${itemCount} line items ${actionText}\n`;
            successMessage += `• Customer: ${customerName}\n`;
            successMessage += `• Total invoices in database: ${uniqueInvoiceNumbers.length}\n`;

            if (storageInfo) {
                successMessage += `\n💾 Storage Info:\n`;
                successMessage += `• Auto-saved to browser storage ✓\n`;
                successMessage += `• Total invoices: ${storageInfo.totalInvoices}\n`;
                successMessage += `• Data protection: Active ✓\n`;
            }

            successMessage += `\n🚀 Ready to create next invoice...`;

            // Show a compact anchored tooltip near the invoice number (non-blocking)
            const compactMsg = `${actionIcon} Invoice ${invoiceNumber} ${actionText} successfully!`;
            if (typeof window.showAnchoredTooltip === 'function') {
                window.showAnchoredTooltip(compactMsg, 'invoiceNumber', 4000);
            } else if (typeof window.showToast === 'function') {
                window.showToast(compactMsg, 'success', 4000);
            } else {
                // Fallback to alert if no UI helpers are available
                alert(compactMsg);
            }

            console.log(`Invoice ${invoiceNumber} ${actionText} successfully`);

            // Display the saved invoice instead of creating a new one
            setTimeout(() => {
                console.log('Displaying saved invoice:', invoiceNumber);
                if (savedInvoiceIndex !== -1) {
                    currentInvoiceIndex = savedInvoiceIndex;
                    showInvoice(savedInvoiceIndex);
                    updateInvoiceNavButtons();
                }
            }, 100);
        }

        // NOTE: saveCurrentInvoice delegator already defined earlier — keep one single delegator

        //--------------------helper-------------------------------------------
        // Enhanced backup functions specifically for new invoices
        function triggerNewInvoiceBackup(invoiceNumber, customerName) {
            // DISABLED: Backup function disabled per user request
            return true;
            /*
            try {
                console.log(`🔄 Triggering backup for new invoice: ${invoiceNumber}`);

                // Create immediate backup file
                const backupFileName = generateNewInvoiceBackupFileName(invoiceNumber);
                const backupData = generateEnhancedBackupData(invoiceNumber, customerName);

                // Store backup metadata
                storeBackupMetadata(invoiceNumber, backupFileName);

                // Optional: Create actual backup file (can be disabled for auto-save only)
                if (getBackupPreference('autoDownloadNewInvoices')) {
                    createBackupFile(backupFileName, backupData);
                }

                console.log(`✅ Backup procedures completed for invoice: ${invoiceNumber}`);
                return true;

            } catch (error) {
                console.error('❌ Error during new invoice backup:', error);
                return false;
            }
            */
        }

        // Generate backup filename for new invoices
        function generateNewInvoiceBackupFileName(invoiceNumber) {
            // DISABLED: Backup function disabled per user request
            return '';
        }

        // Generate enhanced backup data with metadata
        function generateEnhancedBackupData(newInvoiceNumber, customerName) {
            // DISABLED: Backup function disabled per user request
            return '';
        }

        // Store backup metadata in localStorage
        function storeBackupMetadata(invoiceNumber, backupFileName) {
            // DISABLED: Backup function disabled per user request
            return;
        }

        // Check backup threshold (trigger additional backups at certain intervals)
        function checkBackupThreshold() {
            // DISABLED: Backup function disabled per user request
            return;
            /*
            const stats = invoiceStorageManager ? invoiceStorageManager.getStorageStats() : null;
            if (!stats) return;

            const thresholds = [5, 10, 25, 50, 100]; // Backup at these invoice counts
            const currentCount = stats.uniqueInvoices;

            if (thresholds.includes(currentCount)) {
                console.log(`🎯 Backup threshold reached: ${currentCount} invoices`);

                // Create milestone backup
                setTimeout(() => {
                    createMilestoneBackup(currentCount);
                }, 1000);
            }
            */
        }

        // Update backup statistics
        function updateBackupStatistics(isNewInvoice) {
            // DISABLED: Backup function disabled per user request
            return;
        }

        // Emergency backup procedure
        // REPLACE the global emergencyBackupProcedure
        // REPLACE the global emergencyBackupProcedure
        function emergencyBackupProcedure(invoiceNumber) {
            // DISABLED: Backup function disabled per user request
            return;
        }



        // Generate basic CSV if storage manager fails
        function generateBasicCSV() {
            const headers = ["Invoice Number", "Invoice Date", "Customer Name", "Item Desc", "Quantity", "Item Price"];
            let csv = headers.join(',') + '\n';

            allInvoices.forEach(invoice => {
                const row = headers.map(header => `"${invoice[header] || ''}"`);
                csv += row.join(',') + '\n';
            });

            return csv;
        }

        // Check if backup reminder should be shown
        function shouldShowBackupReminder() {
            // DISABLED: Backup function disabled per user request
            return false;
        }

        // Get backup preferences
        function getBackupPreference(key) {
            // DISABLED: Backup function disabled per user request
            return false;
        }

        // Create backup file
        function createBackupFile(fileName, csvContent) {
            // DISABLED: Backup function disabled per user request
            return false;
        }

        // Show notification for new invoice backup
        function showNewInvoiceBackupNotification(invoiceNumber) {
            // DISABLED: Backup function disabled per user request
            return;
        }

        // Show enhanced backup reminder
        function showEnhancedBackupReminder() {
            // DISABLED: Backup function disabled per user request
            return;
        }

        // Close notification functions
        function closeNewInvoiceBackupNotification() {
            const notification = document.querySelector('.new-invoice-backup-notification');
            if (notification) notification.remove();
        }

        function closeEnhancedBackupReminder() {
            const notification = document.querySelector('.enhanced-backup-reminder');
            if (notification) notification.remove();
        }

        // Create milestone backup
        function createMilestoneBackup(invoiceCount) {
            // DISABLED: Backup function disabled per user request
            return;
            /*
            if (!invoiceStorageManager) return;

            try {
                const fileName = `invoices_milestone_${invoiceCount}_invoices_${new Date().toISOString().split('T')[0]}.csv`;
                const csvContent = invoiceStorageManager.generateInvoiceCSV();

                // Show milestone notification
                showMilestoneBackupNotification(invoiceCount, fileName);

                // Optional auto-download
                if (getBackupPreference('autoDownloadMilestones')) {
                    createBackupFile(fileName, csvContent);
                }

            } catch (error) {
                console.error('Error creating milestone backup:', error);
            }
            */
        }

        // Show milestone backup notification
        function showMilestoneBackupNotification(invoiceCount, fileName) {
            // DISABLED: Backup function disabled per user request
            return;
        }

        function closeMilestoneBackupNotification() {
            const notification = document.querySelector('.milestone-backup-notification');
            if (notification) notification.remove();
        }

        function downloadMilestoneBackup(fileName) {
            // DISABLED: Backup download function disabled per user request
            closeMilestoneBackupNotification();
        }

        // Helper function to provide feedback during auto-new invoice
        function showAutoNewInvoiceNotification() {
            // Create notification element
            const notification = document.createElement('div');
            notification.id = 'autoNewInvoiceNotification';
            notification.innerHTML = `
        <div class="auto-new-notification">
            <span class="notification-icon">🚀</span>
            <span class="notification-text">New invoice started automatically</span>
            <button class="notification-close" onclick="closeAutoNewNotification()">×</button>
        </div>
    `;

            document.body.appendChild(notification);

            // Auto-remove after 4 seconds
            setTimeout(() => {
                closeAutoNewNotification();
            }, 4000);
        }


        // Optional: Add user preference for auto-new invoice
        function checkAutoNewInvoicePreference() {
            const preference = localStorage.getItem('autoNewInvoiceEnabled');
            return preference === null ? true : preference === 'true'; // Default to enabled
        }

        function setAutoNewInvoicePreference(enabled) {
            localStorage.setItem('autoNewInvoiceEnabled', enabled.toString());
        }

        // Add this to your settings/preferences section if you want user control
        function toggleAutoNewInvoice() {
            const currentPref = checkAutoNewInvoicePreference();
            const newPref = !currentPref;
            setAutoNewInvoicePreference(newPref);

            alert(`Auto-start new invoice ${newPref ? 'enabled' : 'disabled'}`);
        }

        function closeAutoNewNotification() {
            const notification = document.getElementById('autoNewInvoiceNotification');
            if (notification) {
                notification.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }

        // --------- UI Feedback Functions (moved to ui_feedback.js) ---------
        // Feedback and highlighting functions now handled by ui_feedback.js module
        // Functions available: showNavigationFeedback, highlightMissingFields, checkSaveButtonState, etc.

        // updateAllInvoicesTable is intentionally disabled.
        // The app no longer renders a full invoices table in the UI — we keep the
        // in-memory `window.allInvoices` data but do not populate the old table.
        function updateAllInvoicesTable() {
            // No-op to maintain backwards compatibility for any callers.
            // Previously this populated #allInvoicesTableBody; that table has been removed.
            // If you want to render a new view in future, implement a replacement here.
            return;
        }

        // --------- Items Table Functions (moved to table_manager.js) ---------
        // Table functions now handled by table_manager.js module
        // Functions available: addRow, removeRow, calculateTotals, attachListeners

        // --------- Client Functions (moved to client_manager.js) ---------
        // Client functions now handled by client_manager.js module
        // Functions available: selectClient, populateClientDropdown, saveClientsToLocalStorage, etc.

        function updateInvoiceDisplayFields() {
            if (window.invoiceRenderer && typeof window.invoiceRenderer.updateInvoiceDisplayFields === 'function') return window.invoiceRenderer.updateInvoiceDisplayFields();
            console.warn('invoiceRenderer.updateInvoiceDisplayFields not available');
        }

        // Expose addNewInvoice to window for HTML event handlers
        window.addNewInvoice = addNewInvoice;
        window.toggleUploadSection = toggleUploadSection;
        window.toggleClientSection = toggleClientSection;

        // --------- Export Functions (moved to export_print.js) ---------
        // Export and print functions now handled by export_print.js module
        // Functions available: exportZohoCSV, downloadCSVTemplate

        // --------- Print Functions (moved to export_print.js) ---------
        // Print handlers now in export_print.js module

        // --------- Event Listeners ---------

        // Update your existing DOMContentLoaded event listener
        document.addEventListener('DOMContentLoaded', function() {
            // Your existing code for project code input handling
            if (document.getElementById('projectCodeInput')) {
                document.getElementById('projectCodeInput').addEventListener('input', function() {
                    if (document.getElementById('projectCode')) document.getElementById('projectCode').value = this.value;
                    if (document.getElementById('projectCodeDisplay')) document.getElementById('projectCodeDisplay').textContent = this.value;
                });
            }
            if (document.getElementById('projectCode')) {
                document.getElementById('projectCode').addEventListener('input', function() {
                    if (document.getElementById('projectCodeInput')) document.getElementById('projectCodeInput').value = this.value;
                    if (document.getElementById('projectCodeDisplay')) document.getElementById('projectCodeDisplay').textContent = this.value;
                });
            }
            if (document.getElementById('emirateDropdown'))
                document.getElementById('emirateDropdown').addEventListener('change', updateInvoiceDisplayFields);
            if (document.getElementById('vatTreatmentDropdown'))
                document.getElementById('vatTreatmentDropdown').addEventListener('change', updateInvoiceDisplayFields);
            if (document.getElementById('invoiceStatusDropdown'))
                document.getElementById('invoiceStatusDropdown').addEventListener('change', updateInvoiceDisplayFields);
            if (document.getElementById('clientDropdown'))
                document.getElementById('clientDropdown').addEventListener('change', selectClient);

            // Your existing real-time validation code for manual client fields
            const clientNameField = document.getElementById('manualDisplayName');
            if (clientNameField) {
                let typingTimer;
                const typingDelay = 500;

                clientNameField.addEventListener('keydown', function() {
                    clearTimeout(typingTimer);
                    removeValidationStyling(this);
                });

                clientNameField.addEventListener('keyup', function() {
                    clearTimeout(typingTimer);
                    const clientName = this.value.trim();

                    if (clientName.length > 0) {
                        showCheckingIndicator(this);

                        typingTimer = setTimeout(() => {
                            checkClientNameAvailability(clientName);
                        }, typingDelay);
                    } else {
                        removeValidationStyling(this);
                    }
                });

                clientNameField.addEventListener('blur', function() {
                    const clientName = this.value.trim();
                    if (clientName.length > 0) {
                        checkClientNameAvailability(clientName);
                    }
                });
            }

            const trnField = document.getElementById('manualTRN');
            if (trnField) {
                let trnTypingTimer;
                const typingDelay = 800;

                trnField.addEventListener('keydown', function() {
                    clearTimeout(trnTypingTimer);
                    removeValidationStyling(this);
                });

                trnField.addEventListener('keyup', function() {
                    clearTimeout(trnTypingTimer);
                    const trn = this.value.trim();

                    if (trn.length > 0) {
                        showCheckingIndicator(this);

                        trnTypingTimer = setTimeout(() => {
                            checkTRNAvailability(trn);
                        }, typingDelay);
                    } else {
                        removeValidationStyling(this);
                    }
                });

                trnField.addEventListener('blur', function() {
                    const trn = this.value.trim();
                    if (trn.length > 0) {
                        checkTRNAvailability(trn);
                    }
                });
            }

            // Initialize storage manager
            if (!invoiceStorageManager) {
                invoiceStorageManager = new InvoiceStorageManager();
            }

            // DISABLED: Jump-to-first/last feature disabled per user request
            // Initialize long-press navigation (if module present)
            // setTimeout(() => {
            //     try {
            //         if (window.navigation && typeof window.navigation.initializeLongPress === 'function') {
            //             window.navigation.initializeLongPress();
            //             console.log('Long-press navigation initialized');
            //         } else {
            //             console.log('navigation module not present yet');
            //         }
            //     } catch (e) { console.warn('navigation init error', e); }
            // }, 500); // Slightly longer delay to ensure buttons are ready
        });


        // Manual Client Management Functions

        // Open the manual client popup
        // Delegates to client_add.js implementation when present
        // Provide a fallback only if client_add.js doesn't provide the function
        if (typeof window.openManualClientPopup !== 'function') {
            window.openManualClientPopup = function(){
                console.warn('openManualClientPopup: client_add.js handler missing');
            };
        }

        // Helper function to clear all validation styling (delegates to client_add)
        function clearAllValidationStyling() {
            if (typeof window.clearAllValidationStyling === 'function' && window.clearAllValidationStyling !== clearAllValidationStyling) {
                return window.clearAllValidationStyling();
            }
            // fallback: minimal remove
            const fields = ['manualCompanyName','manualDisplayName','manualAddress1','manualAddress2','manualCity','manualCountry','manualTRN','manualProjectCode','manualContactName','manualMobilePhone','manualEmailID'];
            fields.forEach(id => { const el = document.getElementById(id); if (el) el.classList.remove('error'); });
        }

        // Ensure validation events are properly initialized (delegates to client_add)
        function initializeValidationEvents() {
            if (typeof window.initializeValidationEvents === 'function' && window.initializeValidationEvents !== initializeValidationEvents) {
                return window.initializeValidationEvents();
            }
            // nothing to do in fallback
        }







        // The full storage manager implementation has been removed from the control-panel.
        // To preserve backwards compatibility with other modules which may query
        // window.invoiceStorageManager, expose a lightweight no-op stub with the
        // same method names. A real storage manager should live in a dedicated
        // module (e.g., js/invoice_storage_manager.js) if storage functionality is required.
        class InvoiceStorageManager {
            // Replace your entire NavigationLongPress constructor with this
            constructor() { this.hasUnsavedChanges = false; }

            loadInvoicesFromStorage() { return false; }

            saveInvoicesToStorage() { return false; }

            // Get count of unique invoices (still useful as a pure helper)
            getUniqueInvoiceCount() {
                const uniqueNumbers = new Set();
                allInvoices.forEach(invoice => {
                    if (invoice["Invoice Number"]) {
                        uniqueNumbers.add(invoice["Invoice Number"]);
                    }
                });
                return uniqueNumbers.size;
            }

            // Mark that we have unsaved changes (no-op in control-panel stub)
            markUnsavedChanges() { this.hasUnsavedChanges = true; }

            setupAutoSave() { /* noop */ }

            // Setup before unload handlers (stub)
            setupBeforeUnloadHandlers() {
                // Handle visibility change (tab switching, minimizing)
                // This is a lightweight handler in the control-panel stub; the full
                // storage manager is responsible for robust lifecycle handling.
                try {
                    document.addEventListener('visibilitychange', () => {
                        if (document.hidden && this.hasUnsavedChanges) {
                            try { this.saveInvoicesToStorage(); } catch (e) { /* best-effort */ }
                        }
                    });
                } catch (e) { /* environment may not expose document in tests */ }
            }
            
            forceDownloadBeforeExit() { /* noop */ }

            handlePageUnload() { /* noop */ }

            // Generate backup filename
            generateBackupFileName() {
                const now = new Date();
                const dateStr = now.getFullYear() + '-' +
                    String(now.getMonth() + 1).padStart(2, '0') + '-' +
                    String(now.getDate()).padStart(2, '0');
                const timeStr = String(now.getHours()).padStart(2, '0') + '-' +
                    String(now.getMinutes()).padStart(2, '0') + '-' +
                    String(now.getSeconds()).padStart(2, '0');

                return `invoices_data_${dateStr}_${timeStr}.csv`;
            }

            // Generate CSV content for all invoices
            generateInvoiceCSV() {
                const headers = [
                    "Invoice Number", "Invoice Date", "Due Date", "Invoice Status",
                    "Place Of Supply", "Customer Name", "Client Address", "Client TRN",
                    "Project Code", "Item Desc", "Quantity", "Item Price", "Discount",
                    "Item Total",
                    "Taxable Amount", "Item Tax", "Item Tax %", "Payment Terms",
                    "Tax Registration Number", "Notes"
                ];

                let csv = headers.join(',') + '\n';

                allInvoices.forEach(invoice => {
                    const row = headers.map(header => {
                        const value = invoice[header] || '';
                        // Escape quotes and wrap in quotes if contains comma
                        const escapedValue = String(value).replace(/"/g, '""');
                        return `"${escapedValue}"`;
                    });
                    csv += row.join(',') + '\n';
                });

                return csv;
            }

            handleStorageError() { /* noop */ }

            handleStorageQuotaExceeded() { /* noop */ }

            downloadCurrentData() { return; }

            // Private helper to trigger a CSV download (kept for completeness)
            #downloadBlob(fileName, csvContent) {
                try {
                    const blob = new Blob([csvContent], {
                        type: 'text/csv;charset=utf-8;'
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = fileName;
                    a.style.display = 'none';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    console.log(`Downloaded ${fileName}`);
                } catch (e) {
                    console.error(`Failed to download ${fileName}:`, e);
                }
            }

            // Clear old storage data (stub)
            clearOldStorageData() {
                try {
                    // Keep only essential data
                    localStorage.removeItem(this.storageKey);
                    localStorage.removeItem(this.lastSavedKey);
                    localStorage.removeItem('invoiceApp_metadata');

                    console.log('Cleared old storage data due to quota exceeded');
                } catch (error) {
                    console.error('Error clearing storage:', error);
                }
            }

            // Clear corrupted storage (stub)
            clearCorruptedStorage() {
                try {
                    localStorage.removeItem(this.storageKey);
                    localStorage.removeItem(this.lastSavedKey);
                    localStorage.removeItem('invoiceApp_metadata');
                    console.log('Cleared corrupted storage data');
                } catch (error) {
                    console.error('Error clearing corrupted storage:', error);
                }
            }

            // Update save indicator in UI (best-effort stub)
            updateSaveIndicator() {
                const indicator = document.getElementById('saveIndicator');
                if (indicator) {
                    if (this.hasUnsavedChanges) {
                        indicator.textContent = '● Unsaved changes';
                        indicator.className = 'save-indicator unsaved';
                    } else {
                        indicator.textContent = '✓ All changes saved';
                        indicator.className = 'save-indicator saved';
                    }
                }
            }

            startPeriodicBackup() { /* noop */ }

            createManualBackup() { return; }

            // Get storage statistics (returns null in stub)
            getStorageStats() {
                try {
                    return null;
                } catch (error) {
                    console.error('Error getting storage stats:', error);
                    return null;
                }
            }
        }

        // Keep a global stub instance so other modules can safely call into
        // window.invoiceStorageManager without the control-panel owning storage logic.
        let invoiceStorageManager = new InvoiceStorageManager();

        // --------------storing in the browser data handeler -----------
        // saveCurrentInvoice implementation is delegated to js/save_invoice.js
        if (!window._save_current_implementation_exists) {
            // provide a fallback stub that informs the developer to load the module
            window.saveCurrentInvoice = function() {
                if (typeof window.saveCurrentInvoiceImpl === 'function') return window.saveCurrentInvoiceImpl();
                alert('Save function not available — please ensure js/save_invoice.js is loaded');
                return false;
            };
        }


        // --------- Invoice Clone Functions (moved to invoice_clone.js) ---------
        // Clone and duplicate handling now in invoice_clone.js module
        // Functions available: showDuplicateInvoiceDialog, handleDuplicateInvoiceAction, generateNextInvoiceNumber, etc.


        // UI components for storage management
        function createStorageManagementUI() {
            // Add save indicator to the UI
            const controlsSection = document.querySelector('.controls');
            if (controlsSection && !document.getElementById('saveIndicator')) {
                const saveIndicator = document.createElement('div');
                saveIndicator.id = 'saveIndicator';
                saveIndicator.className = 'save-indicator';
                saveIndicator.textContent = '✓ All changes saved';
                controlsSection.appendChild(saveIndicator);
            }

            // Add storage management buttons
            const buttonsSection = document.querySelector('.buttons');
            if (buttonsSection && !document.getElementById('storageManagementBtns')) {
                const storageDiv = document.createElement('div');
                storageDiv.id = 'storageManagementBtns';
                storageDiv.className = 'buttons';
                storageDiv.style.marginTop = '10px';

                // Storage action buttons removed per user request (Clear Storage / Storage Info / Backup Now)
                // Previously these buttons were added here; they have been intentionally removed to simplify UI.
                storageDiv.innerHTML = '';

                buttonsSection.parentNode.appendChild(storageDiv);
            }
        }



        // Storage action functions removed — UI actions (clear/show/backup) were intentionally removed
        // The underlying storage manager still exists for internal handling, but the user-facing
        // controls were removed from the UI and the corresponding global handler functions
        // have been eliminated to prevent accidental usage.

        // Show storage restoration message
        function showStorageRestorationMessage(invoiceCount, lastSaved) {
            const notification = document.createElement('div');
            notification.className = 'storage-restoration-notification';
            notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">💾</span>
            <div class="notification-text">
                <strong>Data Restored from Storage</strong>
                <br>Loaded ${invoiceCount} invoices (Last saved: ${lastSaved})
            </div>
            <button onclick="closeStorageNotification()" class="notification-close">×</button>
        </div>
    `;

            document.body.appendChild(notification);

            setTimeout(() => {
                closeStorageNotification();
            }, 2000);
        }


        // Close storage notification
        function closeStorageNotification() {
            const notification = document.querySelector('.storage-restoration-notification');
            if (notification) {
                notification.remove();
            }
        }

        // Close backup reminder
        function closeBackupReminder() {
            const notification = document.querySelector('.backup-reminder-notification');
            if (notification) {
                notification.remove();
            }
        }

        // Show backup success message
        function showBackupSuccessMessage() {
            alert(`✅ Backup Created Successfully!\n\n📁 Invoice data downloaded\n🕒 Backup timestamp: ${new Date().toLocaleString()}\n💾 All data preserved safely`);
        }

        // Show storage error message
        function showStorageErrorMessage(error) {
            alert(`❌ Storage Error!\n\nError: ${error}\n\n💡 Recommendations:\n• Free up browser storage space\n• Download current data as backup\n• Clear old website data\n• Try refreshing the page`);
        }

        // Close the manual client popup (delegates to client_add.js)
        if (typeof window.closeManualClientPopup !== 'function') {
            window.closeManualClientPopup = function(){
                const modal = document.getElementById('manualClientModal'); if (modal) modal.style.display = 'none'; document.body.style.overflow = 'auto';
            };
        }

        // Clear form validation errors
        function clearFormErrors() {
            document.querySelectorAll('.form-group input, .form-group select').forEach(element => {
                element.classList.remove('error');
            });
            document.querySelectorAll('.error-message').forEach(error => {
                error.remove();
            });
        }

        // Validate manual client form - delegates to client_add.js
        if (typeof window.validateManualClientForm !== 'function') {
            window.validateManualClientForm = function(){
                console.warn('validateManualClientForm: client_add.js handler missing');
                return { isValid: true, errors: [] };
            };
        }

        // Enhanced function to check for existing clients with detailed feedback
        // Delegate client existence checks to client_add.js
        if (typeof window.checkForExistingClient !== 'function') {
            window.checkForExistingClient = function(clientName, clientTRN){
                console.warn('checkForExistingClient: client_add.js handler missing');
                return { exists:false, type:null, existingClient:null };
            };
        }

        // Show detailed conflict information to user
        function showClientConflictDetails(conflictInfo) {
            // Prefer external handler if present
            if (typeof window.showClientConflictDetails === 'function' && window.showClientConflictDetails !== showClientConflictDetails) return window.showClientConflictDetails(conflictInfo);
            // Fallback: only log conflict info (no blocking alerts or UI messages)
            let message = "Cannot add client due to conflicts:\n\n";
            switch (conflictInfo.type) {
                case 'exact_match':
                    const existingClient = conflictInfo.existingClient;
                    message += "🔍 EXACT MATCH FOUND:\n";
                    message += `• Name: ${existingClient['Display Name'] || existingClient['Client Name'] || 'N/A'}\n`;
                    message += `• TRN: ${existingClient['Tax Registration Number'] || existingClient['TRN Number'] || 'N/A'}\n`;
                    message += `• Address: ${existingClient['Billing Address'] || existingClient['Address Line 1'] || 'N/A'}\n`;
                    message += `• City: ${existingClient['City'] || 'N/A'}\n`;
                    message += `• Country: ${existingClient['Country'] || 'N/A'}\n\n`;
                    message += "✅ This client already exists in your database.\n";
                    message += "💡 You can select it from the dropdown instead.";
                    break;

                case 'name_conflict':
                    const nameClient = conflictInfo.existingClient;
                    message += "🏷️ CLIENT NAME CONFLICT:\n";
                    message += `• Existing client: ${nameClient['Display Name'] || nameClient['Client Name'] || 'N/A'}\n`;
                    message += `• Existing TRN: ${nameClient['Tax Registration Number'] || nameClient['TRN Number'] || 'N/A'}\n`;
                    message += `• Your TRN: ${document.getElementById('manualTRN').value || 'N/A'}\n\n`;
                    message += "⚠️ A client with this name already exists.\n";
                    message += "💡 Use a different name or check if it's the same client.";
                    break;

                case 'trn_conflict':
                    const trnClient = conflictInfo.existingClient;
                    message += "🔢 TRN NUMBER CONFLICT:\n";
                    message += `• Existing client: ${trnClient['Display Name'] || trnClient['Client Name'] || 'N/A'}\n`;
                    message += `• Your client name: ${document.getElementById('manualDisplayName') ? document.getElementById('manualDisplayName').value : (document.getElementById('manualClientName') ? document.getElementById('manualClientName').value : 'N/A')}\n`;
                    message += `• Conflicting TRN: ${trnClient['TRN Number'] || 'N/A'}\n\n`;
                    message += "⚠️ This TRN number is already assigned to another client.\n";
                    message += "💡 Check the TRN number or use a different one.";
                    break;

                case 'cross_conflict':
                    message += "🔀 CROSS-REFERENCE CONFLICT:\n";
                    message += `• Name belongs to: ${conflictInfo.existingClient.name['Display Name'] || conflictInfo.existingClient.name['Client Name'] || 'N/A'}\n`;
                    message += `• TRN belongs to: ${conflictInfo.existingClient.trn['Display Name'] || conflictInfo.existingClient.trn['Client Name'] || 'N/A'}\n\n`;
                    message += "⚠️ The name and TRN you entered belong to different existing clients.\n";
                    message += "💡 Please verify the client information.";
                    break;
            }

            console.warn('Client conflict (suppressed):', message);
        }

        // Manual-client handlers moved to client_add.js
        // Provide minimal delegating wrappers so existing callers still work.
        if (typeof window.saveManualClient !== 'function') {
            window.saveManualClient = function(){
                console.warn('saveManualClient: client_add.js handler missing');
            };
        }

        // Real-time validation / availability checks delegated to client_add.js
        if (typeof window.checkClientNameAvailability !== 'function') {
            window.checkClientNameAvailability = function(clientName){ console.warn('checkClientNameAvailability: client_add.js handler missing'); };
        }
        if (typeof window.checkTRNAvailability !== 'function') {
            window.checkTRNAvailability = function(trn){ console.warn('checkTRNAvailability: client_add.js handler missing'); };
        }
        if (typeof window.showFieldError !== 'function') {
            window.showFieldError = function(fieldId, message){ console.warn('showFieldError missing'); };
        }
        if (typeof window.showValidationError !== 'function') {
            window.showValidationError = function(field, message){ console.warn('showValidationError missing'); };
        }
        if (typeof window.showValidationSuccess !== 'function') {
            window.showValidationSuccess = function(field, message){ console.warn('showValidationSuccess missing'); };
        }
        if (typeof window.removeCheckingIndicator !== 'function') {
            window.removeCheckingIndicator = function(field){ console.warn('removeCheckingIndicator missing'); };
        }
        if (typeof window.showCheckingIndicator !== 'function') {
            window.showCheckingIndicator = function(field){ console.warn('showCheckingIndicator missing'); };
        }
        if (typeof window.removeValidationStyling !== 'function') {
            window.removeValidationStyling = function(field){ console.warn('removeValidationStyling missing'); };
        }

        // System Logs debug modal helpers
        window.openSystemLogsModal = function(){
            const m = document.getElementById('systemLogsModal'); if (!m) return; m.style.display='flex'; document.body.style.overflow='hidden';
            const st = document.getElementById('systemLogsStatus');
            try {
                const pendingRows = (window.sessionLogger && typeof window.sessionLogger.getPendingRows === 'function') ? window.sessionLogger.getPendingRows() : [];
                const pending = pendingRows.length;
                let text = 'Ready — Pending rows: ' + pending + ' — click Preview, Append or Flush';
                if (pending > 0){ text += '\n\nPending items (most recent 5):\n' + pendingRows.slice(-5).map(p => `• ${p.ts} ${p.row && p.row[12] ? '(' + p.row[12] + ')' : ''}`).join('\n'); }
                if (st) st.textContent = text;
                try { const btn = document.getElementById('flushPendingBtn'); if (btn) btn.textContent = pending > 0 ? `Flush Pending (${pending})` : 'Flush Pending'; } catch(e){}
            } catch(e){ if (st) st.textContent = 'Ready — click Preview, Append or Flush'; }
        };
        window.closeSystemLogsModal = function(){ const m = document.getElementById('systemLogsModal'); if (!m) return; m.style.display='none'; document.body.style.overflow='auto'; };
        window.runSystemLogPreview = async function(){
            const st = document.getElementById('systemLogsStatus'); if (st) st.textContent = 'Preparing preview...';
            try {
                window.DEBUG_PREVIEW_APPEND = true;
                await window.sessionLogger.runSessionLog();
                if (st) st.textContent = 'Preview executed (no append). Check console for details.';
            } catch(e){ if (st) st.textContent = 'Preview failed: ' + String(e); }
            finally {
                try { const btn = document.getElementById('flushPendingBtn'); const pending = (window.sessionLogger && typeof window.sessionLogger.getPendingRows === 'function') ? window.sessionLogger.getPendingRows().length : (window.sessionLogger && window.sessionLogger._pendingCount ? window.sessionLogger._pendingCount : 0); if (btn) btn.textContent = pending > 0 ? `Flush Pending (${pending})` : 'Flush Pending'; } catch(e){}
            }
        };

        window.runSystemLogAppend = async function(){
            const st = document.getElementById('systemLogsStatus'); if (st) st.textContent = 'Running append...';
            try {
                window.DEBUG_PREVIEW_APPEND = false;
                const ok = await window.sessionLogger.forceRunSessionLog();
                const lr = window.sessionLogger._lastResult || { ok:false };
                if (ok) {
                    if (st) st.textContent = 'Append succeeded — check System Logs sheet in spreadsheet.';
                } else {
                    if (st) st.textContent = 'Append may have failed — see console for details. Last result: ' + JSON.stringify(lr);
                }
            } catch(e){ if (st) st.textContent = 'Append threw: ' + String(e); }
            finally {
                try { const btn = document.getElementById('flushPendingBtn'); const pending = (window.sessionLogger && typeof window.sessionLogger.getPendingRows === 'function') ? window.sessionLogger.getPendingRows().length : (window.sessionLogger && window.sessionLogger._pendingCount ? window.sessionLogger._pendingCount : 0); if (btn) btn.textContent = pending > 0 ? `Flush Pending (${pending})` : 'Flush Pending'; } catch(e){}
            }
        };

        window.runSystemLogFlush = async function(){
            const st = document.getElementById('systemLogsStatus'); if (st) st.textContent = 'Flushing pending logs...';
            try {
                if (!window.sessionLogger || typeof window.sessionLogger.flushPendingRows !== 'function'){ if (st) st.textContent = 'Flush not available — sessionLogger.flushPendingRows missing'; return; }
                const res = await window.sessionLogger.flushPendingRows();
                if (res && res.ok){ if (st) st.textContent = `Flush complete — flushed ${res.flushed} rows, remaining ${res.remaining}`; } else { if (st) st.textContent = 'Flush failed — reason: ' + (res && res.reason ? res.reason : JSON.stringify(res)); }
            } catch(e){ if (st) st.textContent = 'Flush threw: ' + String(e); }
            finally { try { const btn = document.getElementById('flushPendingBtn'); const pending = (window.sessionLogger && typeof window.sessionLogger.getPendingRows === 'function') ? window.sessionLogger.getPendingRows().length : (window.sessionLogger && window.sessionLogger._pendingCount ? window.sessionLogger._pendingCount : 0); if (btn) btn.textContent = pending > 0 ? `Flush Pending (${pending})` : 'Flush Pending'; } catch(e){} }
        };

        // Save clients to localStorage for persistence
        // Client persistence and refresh functions moved to client_manager.js

        // Export function moved to client_manager.js

        // Close modal when clicking outside
        document.addEventListener('click', function(event) {
            const modal = document.getElementById('manualClientModal');
            if (event.target === modal) {
                closeManualClientPopup();
            }
        });

        // Close modal with Escape key
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                const modal = document.getElementById('manualClientModal');
                if (modal && modal.style.display === 'flex') {
                    closeManualClientPopup();
                }
            }
        });

        // Form validation on input
        // Enhanced real-time validation with immediate feedback
        document.addEventListener('DOMContentLoaded', function() {
            // Real-time validation for client name with debouncing
            const clientNameField = document.getElementById('manualDisplayName') || document.getElementById('manualClientName');
            if (clientNameField) {
                let typingTimer;
                const typingDelay = 500; // 500ms delay after user stops typing

                // Clear timer on keydown (user is typing)
                clientNameField.addEventListener('keydown', function() {
                    clearTimeout(typingTimer);
                    // Remove any existing validation styling while typing
                    removeValidationStyling(this);
                });

                // Start timer on keyup (user stopped typing)
                clientNameField.addEventListener('keyup', function() {
                    clearTimeout(typingTimer);
                    const clientName = this.value.trim();

                    if (clientName.length > 0) {
                        // Show "checking..." indicator
                        showCheckingIndicator(this);

                        typingTimer = setTimeout(() => {
                            checkClientNameAvailability(clientName);
                        }, typingDelay);
                    } else {
                        // Clear validation if field is empty
                        removeValidationStyling(this);
                    }
                });

                // Also check on blur (when user clicks away)
                clientNameField.addEventListener('blur', function() {
                    const clientName = this.value.trim();
                    if (clientName.length > 0) {
                        checkClientNameAvailability(clientName);
                    }
                });
            }

            // Real-time validation for TRN number
            const trnField = document.getElementById('manualTRN');
            if (trnField) {
                let trnTypingTimer;
                const typingDelay = 800; // Longer delay for TRN since it's optional

                trnField.addEventListener('keydown', function() {
                    clearTimeout(trnTypingTimer);
                    removeValidationStyling(this);
                });

                trnField.addEventListener('keyup', function() {
                    clearTimeout(trnTypingTimer);
                    const trn = this.value.trim();

                    if (trn.length > 0) {
                        showCheckingIndicator(this);

                        trnTypingTimer = setTimeout(() => {
                            checkTRNAvailability(trn);
                        }, typingDelay);
                    } else {
                        removeValidationStyling(this);
                    }
                });

                trnField.addEventListener('blur', function() {
                    const trn = this.value.trim();
                    if (trn.length > 0) {
                        checkTRNAvailability(trn);
                    }
                });
            }
        });

        // Client form validation and helper functions are provided by client_add.js



        // --------- Initialization ---------

        // Updated initialization to load persisted clients
        // Fixed window.onload function
        // Updated window.onload function with storage integration
        window.onload = function() {
            console.log('Initializing invoice application...');

            // Storage is managed externally; control panel no longer initializes a full manager here.

            // Load persisted clients from localStorage
            const hasPersistedClients = window.clientManager.loadClientsFromLocalStorage();
            if (hasPersistedClients) {
                console.log('Loaded persisted clients on startup');
            }

            // The storage manager will handle loading invoices
            // so we don't need to load them here separately

            afterDatabaseUpdate();
            updateInvoiceDisplayFields();

            // Initialize foldable sections with correct upload status
            setTimeout(() => {
                initializeFoldableSectionsOnLoad(hasPersistedClients);

                // Create storage management UI
                createStorageManagementUI();
            }, 500);

            // Initialize navigation module (if present)
            // DISABLED: Long-press jump-to-first/last feature disabled per user request
            try {
                // if (window.navigation && typeof window.navigation.initializeLongPress === 'function') window.navigation.initializeLongPress();
                if (window.navigation && typeof window.navigation.updateInvoiceNavButtons === 'function') window.navigation.updateInvoiceNavButtons();
            } catch (e) { console.warn('navigation init failed', e); }

            console.log('Application initialized with', clientsData.length, 'clients and', allInvoices.length, 'invoices');
        }

        // New function to properly initialize sections on page load
        function initializeFoldableSectionsOnLoad(hasPersistedClients) {
            // Set correct upload status based on actual file uploads vs persisted data
            csvFileUploaded = false; // No actual CSV file was uploaded
            invoiceFileUploaded = false; // No actual invoice file was uploaded

            // However, if we have persisted clients, we have client data available
            const hasClientData = hasPersistedClients && clientsData.length > 0;
            const hasInvoiceData = allInvoices && allInvoices.length > 0;

            // Update upload status display
            updateUploadStatusOnLoad(hasClientData, hasInvoiceData);

            // Initialize client section as deactivated
            if (typeof window.deactivateClientSection === 'function') window.deactivateClientSection();

            console.log('Foldable sections initialized:', {
                csvFileUploaded: csvFileUploaded,
                invoiceFileUploaded: invoiceFileUploaded,
                hasClientData: hasClientData,
                hasInvoiceData: hasInvoiceData
            });
        }

        // Updated upload status function for page load
        function updateUploadStatusOnLoad(hasClientData, hasInvoiceData) {
            const statusElement = document.getElementById('uploadStatus');
            const csvStatus = document.getElementById('csvFileStatus');
            const invoiceStatus = document.getElementById('invoiceFileStatus');

            if (!statusElement || !csvStatus || !invoiceStatus) return;

            // Update individual file statuses
            if (hasClientData) {
                csvStatus.textContent = 'Data Available';
                csvStatus.className = 'file-status available';
                csvStatus.title = 'Client data loaded from previous session';
            } else {
                csvStatus.textContent = '';
                csvStatus.className = 'file-status';
            }

            if (hasInvoiceData) {
                invoiceStatus.textContent = 'Data Available';
                invoiceStatus.className = 'file-status available';
                invoiceStatus.title = 'Invoice data loaded from previous session';
            } else {
                invoiceStatus.textContent = '';
                invoiceStatus.className = 'file-status';
            }

            // Update overall status
            if (hasClientData && hasInvoiceData) {
                statusElement.textContent = 'Data available from previous session';
                statusElement.className = 'upload-status data-available';
            } else if (hasClientData || hasInvoiceData) {
                const dataType = hasClientData ? 'client' : 'invoice';
                statusElement.textContent = `${dataType} data available`;
                statusElement.className = 'upload-status partial-data';
            } else {
                statusElement.textContent = 'No files loaded';
                statusElement.className = 'upload-status';
            }
        }

        // Keep the original updateUploadStatus for actual file uploads
        function updateUploadStatus() {
            const statusElement = document.getElementById('uploadStatus');
            const csvStatus = document.getElementById('csvFileStatus');
            const invoiceStatus = document.getElementById('invoiceFileStatus');

            if (!statusElement || !csvStatus || !invoiceStatus) return;

            // Update individual file statuses for actual uploads
            if (csvFileUploaded) {
                csvStatus.textContent = 'Loaded';
                csvStatus.className = 'file-status uploaded';
                csvStatus.title = 'CSV file uploaded successfully';
            } else {
                csvStatus.textContent = '';
                csvStatus.className = 'file-status';
                csvStatus.title = '';
            }

            if (invoiceFileUploaded) {
                invoiceStatus.textContent = 'Loaded';
                invoiceStatus.className = 'file-status uploaded';
                invoiceStatus.title = 'Invoice file uploaded successfully';
            } else {
                invoiceStatus.textContent = '';
                invoiceStatus.className = 'file-status';
                invoiceStatus.title = '';
            }

            // Update overall status for actual uploads
            if (csvFileUploaded && invoiceFileUploaded) {
                statusElement.textContent = 'Both files loaded';
                statusElement.className = 'upload-status complete';

                // Auto-fold the section when both files are uploaded
                if (!uploadSectionCollapsed) {
                    setTimeout(() => {
                        toggleUploadSection();
                    }, 1000);
                }
            } else if (csvFileUploaded || invoiceFileUploaded) {
                statusElement.textContent = '1 of 2 files loaded';
                statusElement.className = 'upload-status partial';
            } else {
                statusElement.textContent = 'No files loaded';
                statusElement.className = 'upload-status';
            }
        }

        // Payments implementation moved to js/payment_manager.js
        // Provide small backwards-compatible shims so in-place references still work.
        // Ensure globals expected by other modules are present and delegate to window.paymentManager
        window.paymentsData = window.paymentsData || [];
        window.paymentFileUploaded = window.paymentFileUploaded || false;

        function noOpWarn(name) { return function() { console.warn('Payments API not loaded:', name); }; }

        if (window.paymentManager) {
            // map the commonly used global functions if they are missing
            window.loadpaymnetCSVfile = window.loadpaymnetCSVfile || window.paymentManager.loadpaymnetCSVfile;
            window.exportPaymentsCSV = window.exportPaymentsCSV || window.paymentManager.exportPaymentsCSV;
            window.generatePaymentsCSVString = window.generatePaymentsCSVString || window.paymentManager.generatePaymentsCSVString;
            window.savePaymentsToLocalStorage = window.savePaymentsToLocalStorage || window.paymentManager.savePaymentsToLocalStorage;
            window.updatePaymentSummaryUI = window.updatePaymentSummaryUI || window.paymentManager.updatePaymentSummaryUI;
            window.getPaymentsForInvoice = window.getPaymentsForInvoice || window.paymentManager.getPaymentsForInvoice;
            window.getTotalPaidForInvoice = window.getTotalPaidForInvoice || window.paymentManager.getTotalPaidForInvoice;
            // expose modal builder if available
            if (typeof window.paymentManager.buildPaymentModal === 'function') {
                window.RecordPayment = window.RecordPayment || function() { const invNo = (document.getElementById('invoiceNumber') && document.getElementById('invoiceNumber').value) || ''; if (!invNo) { alert('Please select or load an invoice first.'); return; } window.paymentManager.buildPaymentModal(invNo); };
            }
        } else {
            // fallbacks: non-fatal no-ops to avoid runtime errors in environments where payment_manager isn't loaded
            window.loadpaymnetCSVfile = window.loadpaymnetCSVfile || noOpWarn('loadpaymnetCSVfile');
            window.exportPaymentsCSV = window.exportPaymentsCSV || noOpWarn('exportPaymentsCSV');
            window.generatePaymentsCSVString = window.generatePaymentsCSVString || function(){ return ''; };
            window.savePaymentsToLocalStorage = window.savePaymentsToLocalStorage || noOpWarn('savePaymentsToLocalStorage');
            window.updatePaymentSummaryUI = window.updatePaymentSummaryUI || noOpWarn('updatePaymentSummaryUI');
            window.getPaymentsForInvoice = window.getPaymentsForInvoice || function(){ return []; };
            window.getTotalPaidForInvoice = window.getTotalPaidForInvoice || function(){ return 0; };
            window.RecordPayment = window.RecordPayment || noOpWarn('RecordPayment');
        }





        // New free-text invoice filtering engine per spec
        // Usage: const result = filterInvoicesQuery("POA between 5k and 12k Mar 2025", invoicesArray);
