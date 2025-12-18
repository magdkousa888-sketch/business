// ============================================
// Invoice Clone Module
// ============================================
// Handles invoice duplication, cloning, and duplicate detection

(function() {
    'use strict';

    // --------- Duplicate Invoice Dialog ---------

    function showDuplicateInvoiceDialog(currentInvoiceData) {
        const existingInvoice = (window.allInvoices || []).find(inv => inv["Invoice Number"] === currentInvoiceData.invoiceNumber);

        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'duplicate-invoice-modal-overlay';
        modalOverlay.innerHTML = `
        <div class="duplicate-invoice-modal">
            <div class="duplicate-modal-header">
                <h3>⚠️ Invoice Already Exists</h3>
                <button onclick="window.invoiceClone.closeDuplicateInvoiceDialog()" class="modal-close">×</button>
            </div>
            
            <div class="duplicate-modal-body">
                <div class="existing-invoice-info">
                    <h4>📋 Existing Invoice Details:</h4>
                    <div class="info-grid">
                        <div class="info-item">
                            <span class="info-label">Invoice Number:</span>
                            <span class="info-value">${currentInvoiceData.invoiceNumber}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Customer:</span>
                            <span class="info-value">${currentInvoiceData.customerName}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Line Items:</span>
                            <span class="info-value">${currentInvoiceData.validItems.length} items</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Invoice Date:</span>
                            <span class="info-value">${existingInvoice ? existingInvoice["Invoice Date"] : 'N/A'}</span>
                        </div>
                    </div>
                </div>
                
                <div class="action-explanation">
                    <h4>🔄 What would you like to do?</h4>
                    <div class="action-options">
                        <div class="action-option clone-option">
                            <strong>📄 Clone:</strong> Create a new invoice copy with next reference number
                            <div class="clone-preview">
                                <span class="preview-label">New invoice number will be:</span>
                                <span class="preview-value" id="clonePreviewNumber">Calculating...</span>
                            </div>
                        </div>
                        <div class="action-option">
                            <strong>❌ Cancel:</strong> Continue editing the current invoice
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="duplicate-modal-actions">
                <button onclick="window.invoiceClone.handleDuplicateInvoiceAction('clone')" 
                        class="action-btn clone-btn">
                    📄 Clone as New Invoice
                </button>
                <button onclick="window.invoiceClone.closeDuplicateInvoiceDialog()" 
                        class="action-btn cancel-btn">
                    ❌ Cancel
                </button>
            </div>
        </div>
    `;

        document.body.appendChild(modalOverlay);
        document.body.style.overflow = 'hidden';

        window.currentInvoiceDataForDialog = currentInvoiceData;
        // Anchor navigation to latest invoice while user handles duplicate options
        window.stickToLatest = true;

        setTimeout(() => {
            const nextInvoiceNumber = generateNextInvoiceNumber();
            const previewElement = document.getElementById('clonePreviewNumber');
            if (previewElement) {
                previewElement.textContent = nextInvoiceNumber;
                previewElement.style.fontWeight = 'bold';
                previewElement.style.color = '#059669';
            }
        }, 100);
    }

    function closeDuplicateInvoiceDialog() {
        const modal = document.querySelector('.duplicate-invoice-modal-overlay');
        if (modal) {
            modal.remove();
            document.body.style.overflow = 'auto';
        }

        if (window.currentInvoiceDataForDialog) {
            delete window.currentInvoiceDataForDialog;
        }
    }

    // --------- Duplicate Action Handlers ---------

    function handleDuplicateInvoiceAction(action) {
        const currentInvoiceData = window.currentInvoiceDataForDialog;

        if (!currentInvoiceData) {
            console.error('No invoice data available for action');
            closeDuplicateInvoiceDialog();
            return;
        }

        closeDuplicateInvoiceDialog();

        switch (action) {
            case 'update':
                handleUpdateExistingInvoice(currentInvoiceData);
                break;

            case 'clone':
                handleCloneInvoicePreview(currentInvoiceData);
                break;

            default:
                console.log('User cancelled duplicate invoice action');
                break;
        }

        delete window.currentInvoiceDataForDialog;
    }

    function handleUpdateExistingInvoice(invoiceData) {
        console.log(`Updating existing invoice: ${invoiceData.invoiceNumber}`);

        window.allInvoices = (window.allInvoices || []).filter(row => row["Invoice Number"] !== invoiceData.invoiceNumber);

        const saveSuccess = typeof window.saveInvoiceData === 'function' ? 
            window.saveInvoiceData(
                invoiceData.invoiceNumber,
                invoiceData.validItems, {
                    invoiceDate: invoiceData.invoiceDate,
                    dueDate: invoiceData.dueDate,
                    paymentTerms: invoiceData.paymentTerms,
                    vatNo: invoiceData.vatNo,
                    customerName: invoiceData.customerName,
                    clientAddress: invoiceData.clientAddress,
                    clientTRN: invoiceData.clientTRN,
                    emirate: invoiceData.emirate,
                    vatTreatment: invoiceData.vatTreatment,
                    invoiceStatus: invoiceData.invoiceStatus,
                    projectCode: invoiceData.projectCode,
                    notes: invoiceData.notes
                },
                false
            ) : false;

        if (saveSuccess && typeof window.postSaveActions === 'function') {
            window.postSaveActions(invoiceData.invoiceNumber, invoiceData.customerName, invoiceData.validItems.length, true, false);
        }
    }

    function handleCloneInvoicePreview(originalInvoiceData) {
        // Perform the actual clone operation (no preview) so the user can immediately save
        console.log(`Cloning invoice immediately from: ${originalInvoiceData.invoiceNumber}`);

        // Delegate to the main clone routine which populates the form with cloned data
        if (typeof cloneCurrentInvoice === 'function') {
            cloneCurrentInvoice();
        }

        // Close the duplicate dialog if it's open (clean UX)
        if (typeof closeDuplicateInvoiceDialog === 'function') closeDuplicateInvoiceDialog();
    }

    // (Preview notification removed - now cloning performs the actual clone immediately)

    function highlightInvoiceNumberChange(newNumber) {
        const invoiceNumberField = document.getElementById('invoiceNumber');
        if (!invoiceNumberField) return;

        const originalStyle = {
            background: invoiceNumberField.style.background,
            border: invoiceNumberField.style.border,
            boxShadow: invoiceNumberField.style.boxShadow
        };

        invoiceNumberField.style.background = '#f0fdf4';
        invoiceNumberField.style.border = '2px solid #059669';
        invoiceNumberField.style.boxShadow = '0 0 0 3px rgba(5, 150, 105, 0.2)';

        const tooltip = document.createElement('div');
        tooltip.className = 'invoice-number-tooltip';
        tooltip.innerHTML = `📄 Cloned with new number: ${newNumber}`;

        const fieldRect = invoiceNumberField.getBoundingClientRect();
        // initial placement (use viewport coordinates)
        tooltip.style.top = (fieldRect.top - 40) + 'px';
        tooltip.style.left = fieldRect.left + 'px';

        document.body.appendChild(tooltip);

        // Ensure the tooltip stays inside the viewport (avoid scrollbar clipping)
        const adjustTooltipPosition = () => {
            const rect = tooltip.getBoundingClientRect();
            const margin = 16; // safe margin from viewport edges
            let newLeft = rect.left;
            let newTop = rect.top;

            // If it would overflow on the right, shift left
            if (rect.right > window.innerWidth - margin) {
                newLeft = Math.max(margin, window.innerWidth - margin - rect.width);
            }
            // Keep a minimum left margin
            if (rect.left < margin) {
                newLeft = margin;
            }
            // Keep it from going above the viewport
            if (rect.top < margin) {
                newTop = margin;
            }
            // Keep it from going below the viewport
            if (rect.bottom > window.innerHeight - margin) {
                newTop = Math.max(margin, window.innerHeight - margin - rect.height);
            }

            tooltip.style.left = (Math.round(newLeft)) + 'px';
            tooltip.style.top = (Math.round(newTop)) + 'px';
        };

        // Run once immediately and also on resize/scroll to keep it visible
        adjustTooltipPosition();
        const _rc = () => adjustTooltipPosition();
        window.addEventListener('resize', _rc);
        window.addEventListener('scroll', _rc, true);

        setTimeout(() => {
            invoiceNumberField.style.background = originalStyle.background;
            invoiceNumberField.style.border = originalStyle.border;
            invoiceNumberField.style.boxShadow = originalStyle.boxShadow;

            if (tooltip.parentNode) {
                tooltip.remove();
            }
            // Clean up listeners
            window.removeEventListener('resize', _rc);
            window.removeEventListener('scroll', _rc, true);
        }, 5000);
    }

    // --------- Invoice Number Generation ---------

    function generateNextInvoiceNumber() {
        function parseInvRef(ref) {
            const s = String(ref || "").trim();
            const m = s.match(/^(\D*?)(\d+)(\D*)$/);
            if (!m) {
                return {
                    prefix: "INV-",
                    num: 0,
                    pad: 7,
                    suffix: ""
                };
            }
            return {
                prefix: m[1],
                num: parseInt(m[2], 10),
                pad: m[2].length,
                suffix: m[3] || ""
            };
        }

        function formatInvRef(prefix, num, pad, suffix) {
            const digits = String(Math.max(0, num)).padStart(pad, "0");
            return `${prefix}${digits}${suffix || ""}`;
        }

        let highestRef = null;
        let maxNum = 0, padLen = 7, pref = "INV-", suf = "";

        const invoices = window.allInvoices || [];
        if (Array.isArray(invoices) && invoices.length > 0) {
            invoices.forEach((inv) => {
                let ref = inv["Invoice Number"];
                if (ref) {
                    const parsed = parseInvRef(ref);
                    if (parsed.num > maxNum) {
                        maxNum = parsed.num;
                        padLen = parsed.pad;
                        pref = parsed.prefix;
                        suf = parsed.suffix;
                        highestRef = ref;
                    }
                }
            });
        }

        const nextRef = formatInvRef(pref, maxNum > 0 ? maxNum + 1 : 1, padLen, suf);

        console.log('Generated next invoice number for clone preview:', nextRef, 'from highest existing:', highestRef);

        return nextRef;
    }

    // --------- Clone Current Invoice ---------

    /**
     * Clones the currently displayed invoice with today's date and next invoice number
     * Called when the Clone Invoice button is clicked
     */
    function cloneCurrentInvoice() {
        console.log('🔄 Cloning current invoice...');

        // Collect current form data
        const el = id => document.getElementById(id);
        
        // Get all the current invoice data
        const currentData = {
            // Client info
            customerName: el('clientNameDisplay') ? el('clientNameDisplay').textContent.trim() : '',
            clientAddress: el('clientAddressDisplay') ? el('clientAddressDisplay').innerHTML : '',
            clientTRN: el('clientTRNDisplay') ? el('clientTRNDisplay').textContent.trim() : '',
            // Country is shown separately (not part of main address)
            clientCountry: el('clientCountryDisplay') ? (el('clientCountryDisplay').textContent || '').trim() : '',
            
            // Invoice details (these will be updated)
            invoiceNumber: el('invoiceNumber') ? el('invoiceNumber').value : '',
            
            // Keep these fields from original
            dueDate: el('dueDate') ? el('dueDate').value : '',
            terms: el('terms') ? el('terms').value : '',
            vatNo: el('vatNo') ? el('vatNo').value : '',
            emirate: el('emirateDropdown') ? el('emirateDropdown').value : '',
            vatTreatment: el('vatTreatmentDropdown') ? el('vatTreatmentDropdown').value : '',
            invoiceStatus: el('invoiceStatusDropdown') ? el('invoiceStatusDropdown').value : 'Sent',
            projectCode: el('projectCodeInput') ? el('projectCodeInput').value : '',
            notes: el('notesText') ? el('notesText').value : '',
            
            // Client dropdown selection
            clientDropdownValue: el('clientDropdown') ? el('clientDropdown').value : ''
        };

        // Collect line items
        const itemRows = document.querySelectorAll('#itemsTable tr');
        const lineItems = [];
        itemRows.forEach(row => {
            const desc = row.querySelector('.desc-input');
            const qty = row.querySelector('.qty-input');
            const rate = row.querySelector('.rate-input');
            const tax = row.querySelector('.tax-percent-input');
            
            if (desc && qty && rate && tax) {
                lineItems.push({
                    description: desc.value,
                    quantity: qty.value,
                    rate: rate.value,
                    tax: tax.value
                });
            }
        });

        // Generate next invoice number
        const nextInvoiceNumber = generateNextInvoiceNumber();
        
        // Get today's date in YYYY-MM-DD format
        const today = new Date();
        const todayStr = today.getFullYear() + '-' + 
                        String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                        String(today.getDate()).padStart(2, '0');

        console.log('📋 Clone details:', {
            original: currentData.invoiceNumber,
            new: nextInvoiceNumber,
            date: todayStr,
            itemCount: lineItems.length
        });

        // Update form with cloned data
        if (el('invoiceNumber')) {
            el('invoiceNumber').value = nextInvoiceNumber;
            // Highlight the changed invoice number
            setTimeout(() => {
                if (typeof highlightInvoiceNumberChange === 'function') {
                    highlightInvoiceNumberChange(currentData.invoiceNumber, nextInvoiceNumber);
                }
            }, 100);
        }
        
        // Set today's date for invoice date and due date
        if (el('invoiceDate')) {
            el('invoiceDate').value = todayStr;
        }
        if (el('dueDate')) {
            el('dueDate').value = todayStr;
        }

        // Keep all other fields the same (they're already populated)
        // Client info, terms, VAT, etc. remain unchanged

        // For clones, always set status to Draft
        if (el('invoiceStatusDropdown')) {
            try {
                el('invoiceStatusDropdown').value = 'Draft';
                console.log('🔁 Set invoice status on clone to Draft');
                // Disable Closed option while editing the cloned invoice
                if (typeof window.setInvoiceStatusClosedAllowed === 'function') window.setInvoiceStatusClosedAllowed(false);
            } catch (e) { /* ignore */ }
        }

            // Preserve separate Billing Country for the cloned invoice
            if (el('clientCountryDisplay')) {
                el('clientCountryDisplay').textContent = currentData.clientCountry || '';
                el('clientCountryDisplay').style.display = currentData.clientCountry ? 'block' : 'none';
            }

        // Rebuild line items table
        const tbody = document.getElementById('itemsTable');
        if (tbody) {
            tbody.innerHTML = '';
            lineItems.forEach(item => {
                if (typeof window.addRow === 'function') {
                    window.addRow();
                    const lastRow = tbody.lastElementChild;
                    if (lastRow) {
                        const descInput = lastRow.querySelector('.desc-input');
                        const qtyInput = lastRow.querySelector('.qty-input');
                        const rateInput = lastRow.querySelector('.rate-input');
                        const taxInput = lastRow.querySelector('.tax-percent-input');
                        
                        if (descInput) descInput.value = item.description;
                        if (qtyInput) qtyInput.value = item.quantity;
                        if (rateInput) rateInput.value = item.rate;
                        if (taxInput) taxInput.value = item.tax;
                    }
                }
            });
        }

        // Recalculate totals
        if (typeof window.calculateTotals === 'function') {
            window.calculateTotals();
        }

        // Mark as new invoice mode so UI toggles (Save vs Clone) and status options are enforced
        window.isNewInvoiceMode = true;
        window.newInvoiceDirty = false;
        if (typeof window.checkSaveButtonState === 'function') window.checkSaveButtonState();

        // Switch to new invoice mode so Save button appears
        window.isNewInvoiceMode = true;
        // Keep navigation anchored on latest invoice: use last index
        if (Array.isArray(window.uniqueInvoiceNumbers) && window.uniqueInvoiceNumbers.length > 0) {
            window.currentInvoiceIndex = window.uniqueInvoiceNumbers.length - 1;
        } else {
            window.currentInvoiceIndex = -1;
        }

        // Set flag to track that this is an unsaved cloned invoice
        window.hasUnsavedClonedInvoice = true;

        // Ensure navigation stays anchored to the latest invoice after cloning
        window.stickToLatest = true;

        // Update button state and navigation
        if (typeof window.checkSaveButtonState === 'function') {
            window.checkSaveButtonState();
        }
        
        if (typeof window.updateInvoiceNavButtons === 'function') {
            window.updateInvoiceNavButtons();
        }

        // Success feedback suppressed (no popup) - keep console log and table update

        // NOTE: allInvoices table rendering and scrolling was removed. The clone action
        // will no longer try to update or scroll any DOM table. Invoice data is still
        // kept in memory/local storage but not shown in a global table view.

        console.log('✅ Invoice cloned successfully:', nextInvoiceNumber);
    }

    /**
     * Show success notification after cloning
     */
    function showCloneSuccessNotification(originalNumber, newNumber) {
        const notification = document.createElement('div');
        notification.className = 'clone-success-notification';
        notification.innerHTML = `
            <div class="clone-success-content">
                <div class="success-icon">✅</div>
                <div class="success-message">
                    <strong>Invoice Cloned Successfully!</strong>
                    <div class="clone-details">
                        <span>Original: <strong>${originalNumber}</strong></span>
                        <span class="arrow">→</span>
                        <span>New: <strong style="color: #059669;">${newNumber}</strong></span>
                    </div>
                    <div class="next-step">Click "Save Invoice" to save the cloned invoice</div>
                </div>
                <button onclick="this.parentElement.parentElement.remove()" class="close-notification">×</button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.style.opacity = '0';
                setTimeout(() => notification.remove(), 300);
            }
        }, 10000);
    }

    // --------- Expose to Window ---------

    window.invoiceClone = {
        showDuplicateInvoiceDialog: showDuplicateInvoiceDialog,
        closeDuplicateInvoiceDialog: closeDuplicateInvoiceDialog,
        handleDuplicateInvoiceAction: handleDuplicateInvoiceAction,
        handleUpdateExistingInvoice: handleUpdateExistingInvoice,
        handleCloneInvoicePreview: handleCloneInvoicePreview,
        generateNextInvoiceNumber: generateNextInvoiceNumber,
        cloneCurrentInvoice: cloneCurrentInvoice
    };

    // Expose key functions for backwards compatibility
    window.showDuplicateInvoiceDialog = showDuplicateInvoiceDialog;
    window.closeDuplicateInvoiceDialog = closeDuplicateInvoiceDialog;
    window.handleDuplicateInvoiceAction = handleDuplicateInvoiceAction;
    window.generateNextInvoiceNumber = generateNextInvoiceNumber;
    window.cloneCurrentInvoice = cloneCurrentInvoice;

    console.log('✅ Invoice Clone module loaded');

})();
