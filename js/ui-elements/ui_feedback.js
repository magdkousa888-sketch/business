// ============================================
// UI Feedback Module
// ============================================
// Handles user notifications, highlights, and visual feedback

(function() {
    'use strict';

    // --------- Navigation Feedback ---------

    function showNavigationFeedback(message) {
        let feedback = document.getElementById('navigationFeedback');
        if (!feedback) {
            feedback = document.createElement('div');
            feedback.id = 'navigationFeedback';
            feedback.className = 'navigation-feedback';
            const wrapper = document.querySelector('.invoice-wrapper');
            if (wrapper) {
                wrapper.appendChild(feedback);
            } else {
                document.body.appendChild(feedback);
            }
        }

        feedback.textContent = message;
        feedback.style.display = 'block';

        setTimeout(() => {
            if (feedback) {
                feedback.style.display = 'none';
            }
        }, 2000);
    }

    function showNavigationWarning(message) {
        showNavigationFeedback(`⚠️ ${message}`);
    }

    function highlightAutoSelection(element, message) {
        element.style.background = '#e0f2fe';
        element.style.borderColor = '#0284c7';
        element.title = message;

        setTimeout(() => {
            element.style.background = '';
            element.style.borderColor = '';
            element.title = '';
        }, 3000);
    }

    // --------- Auto-Load Feedback ---------

    function showAutoLoadFeedback(invoiceNumber) {
        const feedback = document.createElement('div');
        feedback.className = 'auto-load-feedback';
        feedback.innerHTML = `
        <div class="feedback-content">
            <span class="feedback-icon">🎯</span>
            <span class="feedback-text">Auto-loaded last invoice: <strong>${invoiceNumber}</strong></span>
            <button class="feedback-close" onclick="window.uiFeedback.closeAutoLoadFeedback()">×</button>
        </div>
    `;

        document.body.appendChild(feedback);

        setTimeout(() => {
            closeAutoLoadFeedback();
        }, 5000);
    }

    function closeAutoLoadFeedback() {
        const feedback = document.querySelector('.auto-load-feedback');
        if (feedback) {
            feedback.remove();
        }
    }

    // --------- Field Validation Highlights ---------

    function highlightMissingFields(missingMainFields, itemErrors) {
        clearFieldHighlights();

        missingMainFields.forEach(field => {
            let element;
            switch (field) {
                case "Client Name":
                    element = document.getElementById('clientNameDisplay');
                    break;
                case "Invoice Date":
                    element = document.getElementById('invoiceDate');
                    break;
                case "Place of Supply":
                    element = document.getElementById('emirateDropdown');
                    break;
                case "VAT Treatment":
                    element = document.getElementById('vatTreatmentDropdown');
                    break;
            }
            
            if (element) {
                element.style.border = "2px solid #dc2626";
                element.style.backgroundColor = "#fef2f2";
            }
        });

        if (itemErrors.length > 0) {
            const rows = document.querySelectorAll('#itemsTable tr');
            itemErrors.forEach(error => {
                const match = error.match(/Line Item (\d+):/);
                if (match) {
                    const rowIndex = parseInt(match[1]) - 1;
                    if (rows[rowIndex]) {
                        rows[rowIndex].style.border = "2px solid #dc2626";
                        rows[rowIndex].style.backgroundColor = "#fef2f2";
                    }
                }
            });
        }
    }

    function clearFieldHighlights() {
        const fieldsToReset = [
            'clientNameDisplay', 'invoiceDate', 'emirateDropdown', 'vatTreatmentDropdown'
        ];

        fieldsToReset.forEach(fieldId => {
            const element = document.getElementById(fieldId);
            if (element) {
                element.style.border = "";
                element.style.backgroundColor = "";
            }
        });

        document.querySelectorAll('#itemsTable tr').forEach(row => {
            row.style.border = "";
            row.style.backgroundColor = "";
        });
    }

    // --------- Save Button State ---------

    function checkSaveButtonState() {
        const saveButton = document.querySelector('button[onclick="saveCurrentInvoice()"]');
        if (!saveButton) return;

        const clientName = document.getElementById('clientNameDisplay').textContent.trim();

    // --------- Simple Inline Toast (non-blocking) ---------

    function showToast(message, type = 'success', duration = 3000) {
        try {
            const toast = document.createElement('div');
            toast.className = `inline-toast inline-toast-${type || 'info'}`;
            toast.innerHTML = `<span class="toast-message">${message}</span>`;
            document.body.appendChild(toast);
            // Auto remove after duration
            setTimeout(() => {
                if (!toast.parentNode) return;
                toast.classList.add('inline-toast-fade');
                setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 260);
            }, duration || 3000);
        } catch (e) { console.warn('showToast failed', e); }
    }

    // Expose the toast helper globally for use across modules
    window.showToast = showToast;

    // --------- Anchored compact tooltip (near a field, e.g., invoice number) ---------
    function showAnchoredTooltip(message, anchorOrId, duration = 3000) {
        try {
            let anchor = null;
            if (!anchorOrId) anchor = document.getElementById('invoiceNumber');
            else if (typeof anchorOrId === 'string') anchor = document.getElementById(anchorOrId);
            else anchor = anchorOrId;

            const tooltip = document.createElement('div');
            tooltip.className = 'invoice-number-tooltip';
            tooltip.innerHTML = message;
            document.body.appendChild(tooltip);

            const place = () => {
                try {
                    const fieldRect = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : null;
                    const rect = tooltip.getBoundingClientRect();
                    const margin = 12;
                    let top = 16;
                    let left = Math.round((window.innerWidth - rect.width) / 2);

                    if (fieldRect) {
                        // Try placing above anchor; if not enough space, place below
                        const aboveTop = fieldRect.top - rect.height - 8;
                        if (aboveTop > margin) top = Math.round(aboveTop);
                        else top = Math.round(Math.min(window.innerHeight - rect.height - margin, fieldRect.bottom + 8));

                        // Align to anchor left, but keep within viewport
                        left = Math.round(Math.max(margin, Math.min(window.innerWidth - rect.width - margin, fieldRect.left)));
                    }

                    tooltip.style.top = `${top}px`;
                    tooltip.style.left = `${left}px`;
                } catch (e) { console.warn('place anchored tooltip failed', e); }
            };

            place();
            const _rc = () => place();
            window.addEventListener('resize', _rc);
            window.addEventListener('scroll', _rc, true);

            setTimeout(() => {
                tooltip.classList.add('inline-toast-fade');
                setTimeout(() => {
                    if (tooltip && tooltip.parentNode) tooltip.parentNode.removeChild(tooltip);
                    window.removeEventListener('resize', _rc);
                    window.removeEventListener('scroll', _rc, true);
                }, 260);
            }, duration || 3000);

            return tooltip;
        } catch (e) { console.warn('showAnchoredTooltip failed', e); return null; }
    }

    // Expose anchored tooltip helper
    window.showAnchoredTooltip = showAnchoredTooltip;
        const invoiceDate = document.getElementById('invoiceDate').value.trim();
        const invoiceNumber = document.getElementById('invoiceNumber').value.trim();
        const emirate = document.getElementById('emirateDropdown').value.trim();
        const vatTreatment = document.getElementById('vatTreatmentDropdown').value.trim();

        const itemRows = document.querySelectorAll('#itemsTable tr');
        let hasValidItems = false;

        itemRows.forEach(row => {
            const desc = row.querySelector('.desc-input');
            const qty = row.querySelector('.qty-input');
            const rate = row.querySelector('.rate-input');
            const tax = row.querySelector('.tax-percent-input');

            if (desc && qty && rate && tax) {
                const hasDesc = desc.value.trim() !== "";
                const hasQty = parseFloat(qty.value) > 0;
                const hasRate = parseFloat(rate.value) > 0;
                const hasTax = tax.value.trim() !== "";

                if (hasDesc && hasQty && hasRate && hasTax) {
                    hasValidItems = true;
                }
            }
        });

        const allRequiredFieldsFilled = clientName && invoiceDate && invoiceNumber && emirate && vatTreatment && hasValidItems;

        const invoices = window.allInvoices || [];
        const invoiceExists = invoices.some(inv => inv["Invoice Number"] === invoiceNumber);

        const shouldEnable = allRequiredFieldsFilled;

        // Update button text and behavior based on mode
            if (window.isNewInvoiceMode) {
            // Creating new invoice or after cloning - show Save Invoice
            saveButton.textContent = ' Save Invoice';
            saveButton.onclick = function() { saveCurrentInvoice(); };
            saveButton.style.background = "#059669";
                // If user has selected Closed on a new invoice (should be prevented), disallow saving in UI
                const statusEl = document.getElementById('invoiceStatusDropdown');
                const isClosedOnNew = (window.isNewInvoiceMode && statusEl && String(statusEl.value || '').trim() === 'Closed');
                if (isClosedOnNew) {
                    saveButton.disabled = true;
                    saveButton.title = 'Cannot save a newly created or cloned invoice with status Closed. Change status to Draft or Sent.';
                } else {
                    saveButton.title = shouldEnable ? "All required fields completed - click to save" : "Required: Description, Client Name, Invoice Date, Qty>0, Rate>0, Tax%, Place of Supply, VAT Treatment";
                }
        } else {
            // Viewing existing invoice - either Clone or Update if user edited fields
            if (saveButton.dataset.invoiceMode === 'update') {
                // User modified an existing invoice -> allow update (respect validation)
                saveButton.textContent = ' Update Invoice';
                saveButton.onclick = function() { if (typeof window.updateCurrentInvoiceOnSheet === 'function') return window.updateCurrentInvoiceOnSheet(); if (typeof window.saveCurrentInvoice === 'function') return window.saveCurrentInvoice(); };
                saveButton.style.background = "#059669";
                saveButton.title = shouldEnable ? "All required fields completed - click to update" : "Required: Description, Client Name, Invoice Date, Qty>0, Rate>0, Tax%, Place of Supply, VAT Treatment";
            } else {
                // Default: Clone Invoice
                saveButton.textContent = ' Clone Invoice';
                saveButton.onclick = function() { if (typeof window.cloneCurrentInvoice === 'function') window.cloneCurrentInvoice(); };
                saveButton.style.background = "#3b82f6";
                saveButton.title = shouldEnable ? "Clone this invoice with new number and today's date" : "Required: Description, Client Name, Invoice Date, Qty>0, Rate>0, Tax%, Place of Supply, VAT Treatment";
            }
        }

        // Enable/disable button based on validation
        if (window.isNewInvoiceMode) {
            // Save: must meet validation
            // If status is Closed on a new invoice, keep disabled even if other validations pass
            const statusEl2 = document.getElementById('invoiceStatusDropdown');
            const isClosedOnNew2 = (window.isNewInvoiceMode && statusEl2 && String(statusEl2.value || '').trim() === 'Closed');
            saveButton.disabled = !shouldEnable || isClosedOnNew2;
        } else {
            // Viewing existing invoice
            if (saveButton.dataset.invoiceMode === 'update') {
                // When updating an existing invoice, require the same validations as saving
                saveButton.disabled = !shouldEnable;
            } else {
                // Clone: allow even when fields are missing
                saveButton.disabled = false;
            }
        }

        // Visual state
        if (window.isNewInvoiceMode && !shouldEnable) {
            saveButton.style.opacity = "0.6";
            saveButton.style.cursor = "not-allowed";
        } else {
            saveButton.style.opacity = "1";
            saveButton.style.cursor = "pointer";
        }

        // Also update delete button state if available
        try {
            if (typeof window.setDeleteButtonState === 'function') window.setDeleteButtonState();
        } catch (e) {
            console.warn('Failed to update delete button state', e);
        }
    }

    // --------- Expose to Window ---------

    window.uiFeedback = {
        showNavigationFeedback: showNavigationFeedback,
        showNavigationWarning: showNavigationWarning,
        highlightAutoSelection: highlightAutoSelection,
        showAutoLoadFeedback: showAutoLoadFeedback,
        closeAutoLoadFeedback: closeAutoLoadFeedback,
        highlightMissingFields: highlightMissingFields,
        clearFieldHighlights: clearFieldHighlights,
        checkSaveButtonState: checkSaveButtonState
    };

    // Expose key functions for direct access
    window.showNavigationFeedback = showNavigationFeedback;
    window.showNavigationWarning = showNavigationWarning;
    window.highlightMissingFields = highlightMissingFields;
    window.clearFieldHighlights = clearFieldHighlights;
    window.checkSaveButtonState = checkSaveButtonState;
    window.showAutoLoadFeedback = showAutoLoadFeedback;
    window.closeAutoLoadFeedback = closeAutoLoadFeedback;

    console.log('✅ UI Feedback module loaded');

})();
