// bundle-send-invoice.js — Send bundle items to new invoice
(function(){
  'use strict';

  function generateBundleItemsForInvoice() {
    const textBefore = document.getElementById('bundleTextBefore')?.value.trim() || '';
    const defendant = document.getElementById('bundleDefendant')?.value.trim() || '';
    const textAfter = document.getElementById('bundleTextAfter')?.value.trim() || '';
    const addBrackets = document.getElementById('addBrackets')?.checked || false;
    
    const tbody = document.getElementById('bundleItemsBody');
    if (!tbody) return [];

    const items = Array.from(tbody.querySelectorAll('tr')).map(tr => ({
      name: tr.querySelector('.bundle-item-name')?.value.trim() || '',
      qty: parseFloat(tr.querySelector('.bundle-item-qty')?.value) || 0,
      price: parseFloat(tr.querySelector('.bundle-item-price')?.value) || 0,
      taxable: tr.querySelector('.bundle-item-taxable')?.value || 'Standard'
    })).filter(item => item.name);

    if (items.length === 0) return [];

    return items.map(item => {
      const parts = [];
      if (textBefore) parts.push(textBefore);
      if (defendant) parts.push(defendant);
      if (textAfter) parts.push(textAfter);
      
      const itemText = addBrackets ? `(${item.name})` : item.name;
      parts.push(itemText);
      
      // Map taxable to tax percent: Standard = 5%, Zero-rate = 0%, Exempt = "-"
      let taxPercent = 0;
      if (item.taxable === 'Standard') {
        taxPercent = 5;
      } else if (item.taxable === 'Zero-rate') {
        taxPercent = 0;
      } else if (item.taxable === 'Exempt') {
        taxPercent = '-';
      }
      
      return {
        description: parts.join(' '),
        qty: item.qty,
        rate: item.price,
        discount: 0,
        taxPercent: taxPercent
      };
    });
  }

  function sendBundleToInvoice() {
    const invoiceItems = generateBundleItemsForInvoice();
    
    if (invoiceItems.length === 0) {
      alert('No items in bundle to send to invoice');
      return;
    }

    // Get selected client from bundle
    const selectedClient = document.getElementById('bundleClientName')?.value.trim() || '';

    // Close bundle modal
    const overlay = document.getElementById('bundlesModalOverlay');
    if (overlay) {
      overlay.remove();
      document.body.style.overflow = '';
    }

    // Activate a new invoice first (prefer `addNewInvoice`), then populate it
    if (typeof window.addNewInvoice === 'function') {
      console.info('Activating new invoice via addNewInvoice() before applying bundle');
      try { window.addNewInvoice(); } catch (e) { console.warn('addNewInvoice failed, falling back', e); }
    } else if (typeof window.clearInvoice === 'function') {
      window.clearInvoice();
    } else if (typeof window.newInvoice === 'function') {
      window.newInvoice();
    }

    // Wait for invoice UI to be ready, then populate
    setTimeout(() => {
      // Set client if selected
      if (selectedClient) {
        const clientDropdown = document.getElementById('clientDropdown');
        if (clientDropdown && window.clientsData) {
          // Find the client index in clientsData by matching the name
          const clientIndex = window.clientsData.findIndex(client => {
            const displayName = client['Display Name'] || client['Client Name'] || client['Name'] || client['name'] || '';
            return displayName.trim() === selectedClient;
          });
          
          if (clientIndex !== -1) {
            clientDropdown.value = clientIndex;
            // Trigger change and call selectClient to update the display fields
            try { clientDropdown.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
            if (typeof window.selectClient === 'function') window.selectClient();
          }
        }
      }
      const itemsTable = document.getElementById('itemsTable');
      if (!itemsTable) {
        console.error('Invoice items table not found');
        return;
      }

      // Clear existing rows
      itemsTable.innerHTML = '';

      // Add each bundle item to the invoice
      invoiceItems.forEach((item, index) => {
        if (typeof window.addRow === 'function') {
          window.addRow();
          
          // Get the last row added
          const rows = itemsTable.querySelectorAll('tr');
          const row = rows[rows.length - 1];
          
          if (row) {
            // Fill in the row data
            const descInput = row.querySelector('input[placeholder="Description"]') || row.querySelector('td:nth-child(2) input') || row.querySelector('textarea');
            const qtyInput = row.querySelector('input[placeholder="Qty"]') || row.querySelector('td:nth-child(3) input');
            const rateInput = row.querySelector('input[placeholder="Rate"]') || row.querySelector('td:nth-child(4) input');
            const discountInput = row.querySelector('input[placeholder="Discount"]') || row.querySelector('td:nth-child(5) input');
            const taxPercentInput = row.querySelector('select') || row.querySelector('td:nth-child(8) select');
            
            if (descInput) {
              descInput.value = item.description;
              descInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
            if (qtyInput) {
              qtyInput.value = item.qty;
              qtyInput.dispatchEvent(new Event('input', { bubbles: true }));
              qtyInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
            if (rateInput) {
              rateInput.value = item.rate;
              rateInput.dispatchEvent(new Event('input', { bubbles: true }));
              rateInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
            if (discountInput) {
              discountInput.value = item.discount;
              discountInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
            if (taxPercentInput) {
              taxPercentInput.value = item.taxPercent;
              taxPercentInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
        }
      });

      // Recalculate totals
      if (typeof window.calculateInvoiceTotals === 'function') {
        window.calculateInvoiceTotals();
      }

      // Update save button state now that fields/items have changed
      try { if (typeof window.checkSaveButtonState === 'function') window.checkSaveButtonState(); } catch (e) { console.warn('checkSaveButtonState failed', e); }

      console.log(`✅ Sent ${invoiceItems.length} bundle items to invoice`);
    }, 250);
  }

  function initSendToInvoiceButton() {
    const sendBtn = document.getElementById('sendToInvoiceBtn');
    if (!sendBtn) {
      console.warn('bundle-send-invoice: Send to Invoice button not found');
      return;
    }

    sendBtn.onclick = (e) => {
      e.preventDefault();
      sendBundleToInvoice();
    };
  }

  window.sendBundleToInvoice = sendBundleToInvoice;
  window.initSendToInvoiceButton = initSendToInvoiceButton;

})();
