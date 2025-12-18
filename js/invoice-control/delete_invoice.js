// Simple invoice deletion - delete from Google Sheets first, then update UI
(function() {
    'use strict';

    async function deleteInvoice(invoiceNumber) {
        try {
            //console.log('🗑️ Deleting invoice:', invoiceNumber);
            
            // Step 1: Delete from Google Sheets
            const token = await window.ServiceAccountAuth.getAccessToken();
            const spreadsheetId = window.GOOGLE_SPREADSHEET_ID;
            const sheetName = 'Invoices';
            
            // Read invoice numbers from column B (index 1)
            const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!B:B`;
            const readResponse = await fetch(readUrl, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!readResponse.ok) {
                throw new Error('Failed to read sheet');
            }
            
            const readData = await readResponse.json();
            const rows = readData.values || [];
            //console.log('📊 Total rows in sheet:', rows.length);
            
            // Find all rows with this invoice number
            const rowsToDelete = [];
            const targetInvoice = String(invoiceNumber).trim();
            //console.log('🔍 Looking for invoice:', targetInvoice);
            
            rows.forEach((row, index) => {
                if (index === 0) {
                    //console.log('📋 Header:', row[0]);
                    return; // Skip header
                }
                const cellValue = String(row[0] || '').trim();
                if (cellValue === targetInvoice) {
                    //console.log('✅ Found match at row', index + 1, ':', cellValue);
                    rowsToDelete.push(index);
                }
            });
            
            if (rowsToDelete.length === 0) {
                //console.error('❌ Invoice not found. First 5 invoice numbers in sheet:');
                rows.slice(1, 6).forEach((row, i) => {
                    //console.log(`  Row ${i + 2}: "${row[0] || ''}"`);
                });
                throw new Error('Invoice not found in Google Sheets');
            }
            
            //console.log('📍 Deleting', rowsToDelete.length, 'rows:', rowsToDelete.map(r => r + 1));
            
            // Get the actual sheet ID for the Invoices sheet
            const sheetMetaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(sheetId,title))`;
            const metaResponse = await fetch(sheetMetaUrl, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            let sheetId = 0; // Default to first sheet
            if (metaResponse.ok) {
                const metaData = await metaResponse.json();
                const invoicesSheet = metaData.sheets?.find(s => s.properties.title === sheetName);
                if (invoicesSheet) {
                    sheetId = invoicesSheet.properties.sheetId;
                    //console.log('📋 Found sheet ID:', sheetId, 'for sheet:', sheetName);
                } else {
                    //console.warn('⚠️ Sheet not found in metadata, using default sheetId: 0');
                }
            } else {
                //console.warn('⚠️ Failed to get sheet metadata, using default sheetId: 0');
            }
            
            // Delete rows (reverse order to maintain indices)
            const deleteRequests = rowsToDelete.reverse().map(rowIndex => ({
                deleteDimension: {
                    range: {
                        sheetId: sheetId,
                        dimension: 'ROWS',
                        startIndex: rowIndex,
                        endIndex: rowIndex + 1
                    }
                }
            }));
            
            //console.log('🗑️ Sending delete request:', JSON.stringify(deleteRequests, null, 2));
            
            const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
            const batchResponse = await fetch(batchUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ requests: deleteRequests })
            });
            
            if (!batchResponse.ok) {
                const errorText = await batchResponse.text();
               // console.error('❌ Batch delete failed:', batchResponse.status, errorText);
                throw new Error(`Failed to delete from Google Sheets: ${errorText}`);
            }
            
            const deleteResult = await batchResponse.json();
            //console.log('✅ Deleted from Google Sheets, result:', deleteResult);
            
            // Step 2: Update memory
            const beforeMemCount = window.allInvoices.length;
            window.allInvoices = (window.allInvoices || []).filter(inv => 
                String(inv['Invoice Number'] || '').trim() !== targetInvoice
            );
            const afterMemCount = window.allInvoices.length;
           // console.log('💾 Memory updated:', beforeMemCount, '→', afterMemCount, '(removed', beforeMemCount - afterMemCount, 'rows)');
            
            // Step 3: Update UI
            if (typeof window.updateUniqueInvoiceNumbers === 'function') {
              //  console.log('🔄 Updating unique invoice numbers...');
                window.updateUniqueInvoiceNumbers();
              //  console.log('📊 Unique invoices now:', window.uniqueInvoiceNumbers?.length);
            }
            
            // Save to local storage if available
            if (window.invoiceStorageManager) {
                try {
                    if (window.invoiceStorageManager.saveInvoicesToStorage) {
                        window.invoiceStorageManager.saveInvoicesToStorage();
                      //  console.log('💾 Saved to local storage');
                    }
                } catch (err) {
                   console.warn('⚠️ Failed to save to local storage:', err);
                }
            }
            
            // Navigate to previous invoice (go back)
            const currentIndex = window.currentInvoiceIndex || 0;
            const totalAfter = (window.uniqueInvoiceNumbers || []).length;
           // console.log('📍 Current index:', currentIndex, 'Total invoices:', totalAfter);
            
            if (totalAfter > 0) {
                // Go to previous invoice, or last if at beginning
                let newIndex = currentIndex - 1;
                if (newIndex < 0) {
                    newIndex = totalAfter - 1; // Go to last invoice
                }
               // console.log('📍 Navigating to index:', newIndex, '(going back)');
                window.currentInvoiceIndex = newIndex;
                if (typeof window.showInvoice === 'function') {
                    window.showInvoice(newIndex);
                }
            } else {
                console.log('🚫 No invoices left');
            }
            
            // Non-blocking compact tooltip anchored to the invoice number
            const delMsg = `✅ Invoice ${invoiceNumber} deleted successfully`;
            if (typeof window.showAnchoredTooltip === 'function') {
                window.showAnchoredTooltip(delMsg, 'invoiceNumber', 3500);
            } else if (typeof window.showToast === 'function') {
                window.showToast(delMsg, 'success', 3500);
            } else {
                alert(delMsg);
            }
            console.log('✅ Deletion complete');
            
        } catch (err) {
            console.error('❌ Delete failed:', err);
            alert('Failed to delete invoice: ' + err.message);
        }
    }

    // Enable/disable delete button based on ORIGINAL status from Google Sheets
    function updateDeleteButtonState() {
        const btn = document.getElementById('toolbarDeleteInvBtn');
        if (!btn) return;
        
        const invoiceNumber = document.getElementById('invoiceNumber')?.value || '';
        
        if (!invoiceNumber) {
            btn.disabled = true;
            btn.style.opacity = '0.6';
            btn.title = 'No invoice selected';
            return;
        }
        
        // Check the ORIGINAL status from window.allInvoices (not the UI dropdown)
        const originalInvoice = (window.allInvoices || []).find(inv => 
            String(inv['Invoice Number'] || '').trim() === invoiceNumber.trim()
        );
        
        const originalStatus = originalInvoice ? (originalInvoice['Invoice Status'] || '') : '';
        
        if (originalStatus === 'Draft') {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.title = 'Delete this Draft invoice';
        } else {
            btn.disabled = true;
            btn.style.opacity = '0.6';
            btn.title = originalStatus ? 
                `Only Draft invoices can be deleted (original status: ${originalStatus})` : 
                'Invoice not found or not Draft';
        }
    }

    // Modal functions
    function openDeleteModal() {
        //console.log('🔵 openDeleteModal called');
        const modal = document.getElementById('deleteInvoiceModal');
        const invoiceNumber = document.getElementById('invoiceNumber')?.value || '';
        
        // Check ORIGINAL status from Google Sheets data, not UI dropdown
        const originalInvoice = (window.allInvoices || []).find(inv => 
            String(inv['Invoice Number'] || '').trim() === invoiceNumber.trim()
        );
        const originalStatus = originalInvoice ? (originalInvoice['Invoice Status'] || '') : '';
        
        //console.log('Invoice:', invoiceNumber, 'Original Status:', originalStatus);
        
        const messageEl = document.getElementById('deleteModalMessage');
        const invoiceEl = document.getElementById('deleteModalInvoiceNumber');
        const confirmBtn = document.getElementById('deleteModalConfirm');
        
        if (!invoiceNumber) {
            if (messageEl) messageEl.textContent = 'No invoice selected.';
            if (invoiceEl) invoiceEl.textContent = '';
            if (confirmBtn) confirmBtn.disabled = true;
        } else if (originalStatus !== 'Draft') {
            if (messageEl) messageEl.innerHTML = `Only <strong>Draft</strong> invoices can be deleted.<br>Original status from Google Sheets: <strong>${originalStatus || 'Not Found'}</strong>`;
            if (invoiceEl) invoiceEl.textContent = invoiceNumber;
            if (confirmBtn) confirmBtn.disabled = true;
        } else {
            if (messageEl) messageEl.textContent = 'Are you sure you want to permanently delete this invoice?';
            if (invoiceEl) invoiceEl.textContent = invoiceNumber;
            if (confirmBtn) confirmBtn.disabled = false;
        }
        
        if (modal) {
            // Use Bootstrap modal API to show the modal (ensures fade / aria handling)
            try {
                const bsInstance = bootstrap.Modal.getOrCreateInstance(modal);
                bsInstance.show();
            } catch (e) {
                // Fallback to direct display for environments where Bootstrap isn't available
                modal.style.display = 'block';
            }
         //   console.log('✅ Modal opened');
        } else {
            console.error('❌ Modal not found');
        }
    }

    function closeDeleteModal() {
        const modal = document.getElementById('deleteInvoiceModal');
        if (modal) {
            try {
                const bsInstance = bootstrap.Modal.getOrCreateInstance(modal);
                bsInstance.hide();
            } catch (e) {
                modal.style.display = 'none';
            }
        }
    }

    function confirmDelete() {
        //console.log('🔵 confirmDelete called');
        const invoiceNumber = document.getElementById('invoiceNumber')?.value || '';
        
        // Double-check ORIGINAL status from Google Sheets data
        const originalInvoice = (window.allInvoices || []).find(inv => 
            String(inv['Invoice Number'] || '').trim() === invoiceNumber.trim()
        );
        const originalStatus = originalInvoice ? (originalInvoice['Invoice Status'] || '') : '';
        
        if (!invoiceNumber) {
            alert('No invoice selected');
            return;
        }
        
        if (originalStatus !== 'Draft') {
            alert(`Only Draft invoices can be deleted. Original status: ${originalStatus || 'Not Found'}`);
            return;
        }
        
        closeDeleteModal();
        deleteInvoice(invoiceNumber);
    }

    // Setup modal buttons and status monitoring
    document.addEventListener('DOMContentLoaded', function() {
        const closeBtn = document.getElementById('deleteModalClose');
        const cancelBtn = document.getElementById('deleteModalCancel');
        const confirmBtn = document.getElementById('deleteModalConfirm');
        
        if (closeBtn) closeBtn.addEventListener('click', closeDeleteModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeDeleteModal);
        if (confirmBtn) confirmBtn.addEventListener('click', confirmDelete);
        
        // Update button state when status changes
        const statusDropdown = document.getElementById('invoiceStatusDropdown');
        if (statusDropdown) {
            statusDropdown.addEventListener('change', updateDeleteButtonState);
        }
        
        // Update button state when invoice is shown
        const originalShow = window.showInvoice;
        if (typeof originalShow === 'function') {
            window.showInvoice = function() {
                const result = originalShow.apply(this, arguments);
                setTimeout(updateDeleteButtonState, 50);
                return result;
            };
        }
        
        // Initial state
        setTimeout(updateDeleteButtonState, 100);
    });

    // Expose functions
    window.openDeleteModal = openDeleteModal;
    window.closeDeleteModal = closeDeleteModal;
    window.updateDeleteButtonState = updateDeleteButtonState;

})();

