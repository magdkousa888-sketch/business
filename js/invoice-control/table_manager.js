// ============================================
// Table Manager Module
// ============================================
// Handles invoice items table operations: add/remove rows, calculations

(function() {
    'use strict';

    // --------- Table Row Operations ---------

    function addRow() {
        const tbody = document.getElementById('itemsTable');
        const newRow = document.createElement('tr');
        const rowCount = tbody.children.length + 1;
        newRow.innerHTML = `
        <td>${rowCount}</td>
        <td>
            <textarea class="desc-input" placeholder="Description"></textarea>
            <span class="value-for-print" style="display:none"></span>
        </td>
        <td>
            <input type="number" class="qty-input" value="1.00" step="0.01">
            <span class="value-for-print" style="display:none"></span>
        </td>
        <td>
            <input type="number" class="rate-input" value="0.00" step="0.01">
            <span class="value-for-print" style="display:none"></span>
        </td>
        <td>
            <input type="number" class="discount-input" value="0.00" step="0.01">
            <span class="value-for-print" style="display:none"></span>
        </td>
        <td class="taxable-amount">
            <span class="value-for-screen">0.00</span>
            <span class="value-for-print" style="display:none">0.00</span>
        </td>
        <td class="tax-amount">
            <span class="value-for-screen">0.00</span>
            <span class="value-for-print" style="display:none">0.00</span>
        </td>
        <td>
            <select class="tax-percent-input">
                <option value="5">5</option>
                <option value="0">0</option>
                <option value="-">-</option>
            </select>
            <span class="value-for-print" style="display:none"></span>
        </td>
        <td class="line-total">
            <span class="value-for-screen">0.00</span>
            <span class="value-for-print" style="display:none">0.00</span>
        </td>
        <td class="editable-hide">
            <button class="remove-btn" onclick="window.tableManager.removeRow(this)">×</button>
        </td>
    `;
        tbody.appendChild(newRow);
        attachListeners(newRow);
        calculateTotals();
    }

    function removeRow(btn) {
        const row = btn.closest('tr');
        row.remove();
        calculateTotals();
    }

    function attachListeners(row) {
        row.querySelectorAll('.qty-input, .rate-input, .discount-input, .tax-percent-input').forEach(input => {
            input.addEventListener('input', calculateTotals);
            input.addEventListener('change', calculateTotals);
        });
    }

    // Robust delegation: ensure any input/change inside #itemsTable triggers recalculation
    function initTableDelegation() {
        const tbody = document.getElementById('itemsTable');
        if (!tbody) return;

        // Attach delegated listeners once
        if (!tbody._invoiceDelegationAttached) {
            tbody.addEventListener('input', (e) => {
                const tgt = e.target;
                if (!tgt) return;
                if (tgt.matches('.qty-input, .rate-input, .discount-input, .tax-percent-input, .desc-input')) {
                    calculateTotals();
                }
            });
            tbody.addEventListener('change', (e) => {
                const tgt = e.target;
                if (!tgt) return;
                if (tgt.matches('.qty-input, .rate-input, .discount-input, .tax-percent-input')) {
                    calculateTotals();
                }
            });
            tbody._invoiceDelegationAttached = true;
        }

        // Ensure existing rows have per-row listeners attached
        tbody.querySelectorAll('tr').forEach(tr => attachListeners(tr));
    }

    // --------- Calculation Delegator ---------

    function calculateTotals() {
        if (window.invoiceRenderer && typeof window.invoiceRenderer.calculateTotals === 'function') {
            return window.invoiceRenderer.calculateTotals();
        }
        console.warn('invoiceRenderer.calculateTotals not available');
    }

    // --------- Expose to Window ---------

    window.tableManager = {
        addRow: addRow,
        removeRow: removeRow,
        attachListeners: attachListeners,
        calculateTotals: calculateTotals
    };

    // Expose for HTML onclick handlers
    window.addRow = addRow;
    window.removeRow = removeRow;
    window.calculateTotals = calculateTotals;

    // Initialize table delegation and listeners on DOM ready
    document.addEventListener('DOMContentLoaded', () => {
        try { initTableDelegation(); } catch (e) { console.warn('initTableDelegation failed', e); }
    });

    console.log('✅ Table Manager module loaded');

})();
