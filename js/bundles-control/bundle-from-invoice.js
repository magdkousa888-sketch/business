/* Bundle From Invoice - Load current invoice data as a new bundle */
(function(){
  'use strict';

  /**
   * Parse rendered invoice items and populate bundle form
   * @param {HTMLElement} tbody - Bundle items table body element
   * @param {HTMLElement} body - Modal body element containing form fields
   */
  window.bundleFromInvoice = function(tbody, body) {
    try {
      // Get invoice number and date for bundle name
      const invoiceNumberEl = document.getElementById('invoiceNumber');
      const invoiceDateEl = document.getElementById('invoiceDate');
      const clientNameEl = document.getElementById('clientNameDisplay');
      
      if (!invoiceNumberEl || !invoiceDateEl) {
        alert('No invoice is currently loaded. Please load an invoice first.');
        return;
      }

      const invoiceNumber = invoiceNumberEl.value.trim();
      const invoiceDate = invoiceDateEl.value;
      const clientName = clientNameEl ? clientNameEl.textContent.trim() : '';

      if (!invoiceNumber) {
        alert('Invoice number is empty. Please ensure an invoice is loaded.');
        return;
      }

      // Get all rendered invoice items from the table
      const itemsTable = document.getElementById('itemsTable');
      if (!itemsTable) {
        alert('Invoice items table not found.');
        return;
      }

      const rows = itemsTable.querySelectorAll('tr');
      if (!rows || rows.length === 0) {
        alert('No items found in the current invoice.');
        return;
      }

      // Clear existing bundle items
      tbody.innerHTML = '';

      // Extract items from invoice table
      let itemCount = 0;
      rows.forEach(row => {
        const descInput = row.querySelector('.desc-input, textarea[placeholder="Description"]');
        const qtyInput = row.querySelector('.qty-input');
        const rateInput = row.querySelector('.rate-input');
        const taxSelect = row.querySelector('.tax-percent-input, select');

        if (!descInput || !qtyInput || !rateInput) return;

        const description = descInput.value.trim();
        const qty = parseFloat(qtyInput.value) || 0;
        const rate = parseFloat(rateInput.value) || 0;

        // Skip empty rows
        if (!description && qty === 0 && rate === 0) return;

        // Map tax percentage to taxable type
        let taxable = 'Standard'; // Default
        if (taxSelect) {
          const taxValue = parseFloat(taxSelect.value) || 0;
          if (taxValue === 5) {
            taxable = 'Standard';
          } else if (taxValue === 0) {
            taxable = 'Zero-rate';
          } else {
            taxable = 'Exempt';
          }
        }

        // Create new bundle item row
        const tr = document.createElement('tr');
        if (window.bundleUtils && typeof window.bundleUtils.createBundleItemRow === 'function') {
          window.bundleUtils.createBundleItemRow(tr);
        } else {
          // Fallback if bundleUtils not available
          tr.innerHTML = `
            <td><input type="text" class="bundle-item-name" placeholder="Item name" value=""></td>
            <td><input type="number" class="bundle-item-qty" min="0" step="1" value="1"></td>
            <td><input type="number" class="bundle-item-price" min="0" step="0.01" value="0"></td>
            <td>
              <select class="bundle-item-taxable">
                <option value="Standard">Standard</option>
                <option value="Zero-rate">Zero-rate</option>
                <option value="Exempt">Exempt</option>
              </select>
            </td>
            <td class="bundle-item-total">0.00</td>
            <td><button type="button" class="remove-btn" title="Remove item">×</button></td>
          `;
        }

        // Populate the row with invoice data
        const nameInput = tr.querySelector('.bundle-item-name');
        const qtyBundleInput = tr.querySelector('.bundle-item-qty');
        const priceInput = tr.querySelector('.bundle-item-price');
        const taxableSelect = tr.querySelector('.bundle-item-taxable');

        if (nameInput) nameInput.value = description;
        if (qtyBundleInput) qtyBundleInput.value = qty;
        if (priceInput) priceInput.value = rate.toFixed(2);
        if (taxableSelect) taxableSelect.value = taxable;

        // Add event listeners
        const qtyField = tr.querySelector('.bundle-item-qty');
        const priceField = tr.querySelector('.bundle-item-price');
        const removeBtn = tr.querySelector('.remove-btn');

        if (qtyField && window.bundleUtils && typeof window.bundleUtils.updateRowTotal === 'function') {
          qtyField.addEventListener('input', () => window.bundleUtils.updateRowTotal(tr));
        }
        if (priceField && window.bundleUtils && typeof window.bundleUtils.updateRowTotal === 'function') {
          priceField.addEventListener('input', () => window.bundleUtils.updateRowTotal(tr));
        }
        if (removeBtn) {
          removeBtn.onclick = () => { 
            tr.remove(); 
            if (window.bundleUtils && typeof window.bundleUtils.updateGrandTotal === 'function') {
              window.bundleUtils.updateGrandTotal(tbody);
            }
          };
        }

        // Update row total
        if (window.bundleUtils && typeof window.bundleUtils.updateRowTotal === 'function') {
          window.bundleUtils.updateRowTotal(tr);
        }

        tbody.appendChild(tr);
        itemCount++;
      });

      // Update grand total
      if (window.bundleUtils && typeof window.bundleUtils.updateGrandTotal === 'function') {
        window.bundleUtils.updateGrandTotal(tbody);
      }

      // Populate bundle metadata
      const bundleNameInput = body.querySelector('#bundleName');
      const bundleClientNameSelect = body.querySelector('#bundleClientName');
      
      if (bundleNameInput) {
        bundleNameInput.value = `Invoice ${invoiceNumber} - ${invoiceDate}`;
      }
      
      if (bundleClientNameSelect && clientName) {
        // Try to find and select the client
        const options = bundleClientNameSelect.querySelectorAll('option');
        for (let option of options) {
          if (option.value === clientName || option.textContent.trim() === clientName) {
            bundleClientNameSelect.value = option.value;
            break;
          }
        }
      }

      if (itemCount === 0) {
        alert('No valid items found in the current invoice.');
        return;
      }

      // Reset to "new bundle" mode - this makes the Save button appear instead of Update
      if (window._bundleManagerGlobal && typeof window._bundleManagerGlobal.setCurrentBundleIndex === 'function') {
        window._bundleManagerGlobal.setCurrentBundleIndex(null);
      }

      alert(`✅ Bundle created from invoice!\n\n• ${itemCount} item(s) loaded\n• Invoice: ${invoiceNumber}\n• Date: ${invoiceDate}\n\nYou can now edit and save this bundle.`);

    } catch (error) {
      console.error('Error loading invoice as bundle:', error);
      alert('Failed to load invoice data. Please check the console for details.');
    }
  };

  console.log('✅ bundle-from-invoice.js loaded');
})();
