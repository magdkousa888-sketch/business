/* Payment Manager - extracted from invoice-control-panel.js
   All payment related functions (CSV load/export, localStorage persistence, UI helpers,
   payment modal, computations) live here. Provides a `window.paymentManager` namespace
   and re-exports old global names for backwards compatibility.
*/
(function(){
	'use strict';

	// ---------------------- Globals ----------------------
	const LS_KEY_PAYMENTS = 'invoiceApp_paymentsData';
	const LS_KEY_PAYMENTS_LAST = 'invoiceApp_paymentsLastSaved';

	// Expose or reuse globals from main script
	window.paymentsData = window.paymentsData || [];
	window.paymentFileUploaded = window.paymentFileUploaded || false;

	// CSV header to export (matches your sample + Bank Name)
	const PAYMENT_HEADERS = [
		"Payment Number",
		"CustomerPayment ID",
		"Mode",
		"CustomerID",
		"Description",
		"Exchange Rate",
		"Amount",
		"Unused Amount",
		"Bank Charges",
		"Reference Number",
		"Currency Code",
		"Payment Number Prefix",
		"Payment Number Suffix",
		"Customer Name",
		"Payment Type",
		"Date",
		"Created Time",
		"Deposit To",
		"Deposit To Account Code",
		"Bank Name",
		"Payment Status",
		"InvoicePayment ID",
		"Amount Applied to Invoice",
		"Invoice Payment Applied Date",
		"Invoice Number",
		"Invoice Date"
	];

	// ---------------------- Helpers ----------------------
	function parseNumber(n) {
		if (n === null || n === undefined) return 0;
		const s = String(n).replace(/,/g, '').trim();
		const v = parseFloat(s);
		return isNaN(v) ? 0 : v;
	}

	function formatNumber(n) {
		// Reuse if available
		if (typeof window.formatNumber === 'function') return window.formatNumber(n);
		const num = parseFloat(n || 0);
		return num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	}

	function nowISO() {
		return new Date().toISOString();
	}

	function todayISODate() {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
	}

	function getCurrentInvoiceNumber() {
		const el = document.getElementById('invoiceNumber');
		return el ? el.value.trim() : '';
	}

	function getCurrentCustomerName() {
		const el = document.getElementById('clientNameDisplay');
		return el ? el.textContent.trim() : '';
	}

	function getCurrentInvoiceDate() {
		const el = document.getElementById('invoiceDate');
		return el ? el.value : '';
	}

	function getGrandTotalNumber() {
		const el = document.getElementById('grandTotal');
		if (!el) return 0;
		return parseNumber(el.textContent);
	}

	function csvRowFromPayment(p) {
		return PAYMENT_HEADERS.map(h => {
			const v = p[h] ?? '';
			const escaped = String(v).replace(/"/g, '""');
			return `"${escaped}"`;
		}).join(',');
	}

	function savePaymentsToLocalStorage() {
		try {
			if (typeof localStorage === 'object' && typeof localStorage.setItem === 'function') {
				localStorage.setItem(LS_KEY_PAYMENTS, JSON.stringify(window.paymentsData || []));
				localStorage.setItem(LS_KEY_PAYMENTS_LAST, nowISO());
			} else {
				// fallback for non-browser/test environments
				window._payments_local_stub = JSON.stringify(window.paymentsData || []);
			}
		} catch (e) {
			console.error('Error saving payments:', e);
		}
	}

	function loadPaymentsFromLocalStorage() {
		if (window.dataLoader && typeof window.dataLoader.loadPaymentsFromLocalStorage === 'function') return window.dataLoader.loadPaymentsFromLocalStorage();
		try {
			let val = null;
			if (typeof localStorage === 'object' && typeof localStorage.getItem === 'function') {
				val = localStorage.getItem(LS_KEY_PAYMENTS);
			} else {
				val = window._payments_local_stub || null;
			}
			if (val) {
				const data = JSON.parse(val);
				if (Array.isArray(data) && data.length) {
					window.paymentsData = data;
					window.paymentFileUploaded = true;
					return true;
				}
			}
		} catch(e) {
			console.warn('payments: failed to load from localStorage', e);
		}
		console.warn('dataLoader.loadPaymentsFromLocalStorage missing and no localStorage data');
		return false;
	}

	function getPaymentsForInvoice(invoiceNumber) {
		if (!invoiceNumber) return [];
		return (window.paymentsData || []).filter(r => (r["Invoice Number"] || '').trim() === invoiceNumber);
	}

	function getTotalPaidForInvoice(invoiceNumber) {
		return getPaymentsForInvoice(invoiceNumber).reduce((sum, r) => {
			return sum + parseNumber(r["Amount Applied to Invoice"]);
		}, 0);
	}

	function updatePaymentSummaryUI(invoiceNumber) {
		const total = getTotalPaidForInvoice(invoiceNumber);
		const grand = getGrandTotalNumber();
		const paidSpan = document.getElementById('balanceDue'); // In your HTML, this is labeled "Payment made"
		const remainSpan = document.getElementById('remainingBalance');

		if (paidSpan) paidSpan.textContent = '' + formatNumber(total);
		if (remainSpan) remainSpan.textContent = '' + formatNumber(Math.max(grand - total, 0));

		// Optional: show simple breakdown list under totals
		let breakdown = document.getElementById('paymentsBreakdown');
		if (!breakdown) {
			const totalsContainer = document.querySelector('.totals');
			if (totalsContainer && totalsContainer.parentNode) {
				breakdown = document.createElement('div');
				breakdown.id = 'paymentsBreakdown';
				breakdown.style.fontSize = '10px';
				breakdown.style.marginBottom = '10px';
				breakdown.style.color = '#333';
				totalsContainer.insertAdjacentElement('afterend', breakdown);
			}
		}
		if (breakdown) {
			const rows = getPaymentsForInvoice(invoiceNumber);
			if (rows.length === 0) {
				breakdown.textContent = '';
			} else {
				const items = rows.map(r => {
					const d = r["Invoice Payment Applied Date"] || r["Date"] || '';
					const a = parseNumber(r["Amount Applied to Invoice"]);
					const m = r["Mode"] || '';
					const bn = r["Bank Name"] || r["Deposit To"] || '';
					const ref = r["Reference Number"] || '';
					const details = [];
					if (m) details.push(m);
					if (bn) details.push(`Bank: ${bn}`);
					if (ref) details.push(`Ref: ${ref}`);
					return `/ ${d} / AED ${formatNumber(a)}${details.length ? ` (${details.join(', ')})` : ''}`;
				});
				breakdown.textContent = `Payments (${rows.length}):\n${items.join('\n')}`;
			}
		}
	}

	function bumpUploadStatus() {
		try {
			const statusElement = document.getElementById('uploadStatus');
			const csvStatus = document.getElementById('csvFileStatus');
			const invoiceStatus = document.getElementById('invoiceFileStatus');
			const paymentStatus = document.getElementById('paymentfilestatus');

			const csvLoaded = !!(window.clientsData && window.clientsData.length);
			const invLoaded = !!(window.allInvoices && window.allInvoices.length);
			const payLoaded = !!(window.paymentsData && window.paymentsData.length);

			if (paymentStatus) {
				if (payLoaded) {
					paymentStatus.textContent = 'Loaded';
					paymentStatus.className = 'file-status uploaded';
				} else {
					paymentStatus.textContent = '';
					paymentStatus.className = 'file-status';
				}
			}

			if (statusElement) {
				const count = [csvLoaded, invLoaded, payLoaded].filter(Boolean).length;
				if (count === 3) {
					statusElement.textContent = 'All files loaded';
					statusElement.className = 'upload-status complete';
				} else if (count > 0) {
					statusElement.textContent = `${count} of 3 files loaded`;
					statusElement.className = 'upload-status partial';
				} else {
					statusElement.textContent = 'No files loaded';
					statusElement.className = 'upload-status';
				}
			}
		} catch (e) {
			console.warn('payments: updateUploadStatus extension failed', e);
		}
	}

	function updateUploadStatusWrapper() {
		// call original if exists, then extend
		if (typeof window.__origUpdateUploadStatus === 'function') {
			try { window.__origUpdateUploadStatus(); } catch (e) {}
		}
		bumpUploadStatus();
	}

	// Compute next Payment Number (numeric)
	function getNextPaymentNumber() {
		const nums = (window.paymentsData || [])
			.map(r => parseInt(r["Payment Number"], 10))
			.filter(n => !isNaN(n));
		const max = nums.length ? Math.max(...nums) : 0;
		return max + 1;
	}

	function getNextInvoicePaymentID() { return 'loc-invpay-' + Date.now() + '-' + Math.floor(Math.random() * 100000); }
	function getNextCustomerPaymentID() { return 'loc-custpay-' + Date.now() + '-' + Math.floor(Math.random() * 100000); }

	// ---------------------- CSV Load/Export ----------------------
	window.loadpaymnetCSVfile = function(event) {
		const file = event.target.files[0];
		if (!file) {
			window.paymentFileUploaded = false;
			updateUploadStatusWrapper();
			return;
		}

		if (!window.Papa) {
			if (typeof window.showToast === 'function') { window.showToast('PapaParse not found. Cannot load payments CSV.', 'warning', 4000); } else { alert('PapaParse not found. Cannot load payments CSV.'); }
			return;
		}

		Papa.parse(file, {
			header: true,
			skipEmptyLines: true,
			complete: function(results) {
				if (results.data && results.data.length > 0) {
					// normalize minimal required fields
					window.paymentsData = results.data.map(r => {
						const row = {};
						PAYMENT_HEADERS.forEach(h => { row[h] = r[h] ?? ''; });
						return row;
					});
					window.paymentFileUploaded = true;
					savePaymentsToLocalStorage();
					updateUploadStatusWrapper();

					const loadedMsg = `✅ Payments CSV Loaded — ${window.paymentsData.length} payment applications loaded. Payments will now reflect on invoices.`;
				if (typeof window.showToast === 'function') { window.showToast(loadedMsg, 'success', 5000); } else { alert(loadedMsg); }
					// refresh payment summary for current invoice
					updatePaymentSummaryUI(getCurrentInvoiceNumber());
				} else {
					window.paymentFileUploaded = false;
					updateUploadStatusWrapper();
					if (typeof window.showToast === 'function') { window.showToast('No payment data found in CSV.', 'warning', 4000); } else { alert('No payment data found in CSV.'); }
				}
			},
			error: function(error) {
				window.paymentFileUploaded = false;
				updateUploadStatusWrapper();
				const errMsg = 'Error reading payments CSV: ' + error.message;
				if (typeof window.showToast === 'function') { window.showToast(errMsg, 'warning', 5000); } else { alert(errMsg); }
			}
		});
	};

	window.exportPaymentsCSV = function() {
		const data = window.paymentsData || [];
		const headerLine = PAYMENT_HEADERS.join(',');
		const rows = data.map(csvRowFromPayment);
		const csv = [headerLine, ...rows].join('\n');

		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = `Customer_Payment_Updated_${new Date().toISOString().split('T')[0]}.csv`;
		a.style.display = 'none';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);

		const expMsg = `📄 Payments CSV exported — ${data.length} rows`;
		if (typeof window.showToast === 'function') { window.showToast(expMsg, 'success', 3500); } else { alert(expMsg); }
	};

	// ---------------------- UI Integration ----------------------
	function attachPaymentButtonHandler() {
		try {
			const paymentBtn = document.getElementById('recordPaymentForClientBtn');
			if (!paymentBtn) return;

			paymentBtn.onclick = function() {
				const clientDropdown = document.getElementById('clientDropdown');
				const selectedClient = clientDropdown?.options[clientDropdown.selectedIndex]?.text?.trim();
				
				if (!selectedClient || selectedClient === '-- Upload CSV file first --' || selectedClient === '-- Select a client --') {
					if (typeof window.showToast === 'function') { window.showToast('Please select a client first.', 'warning', 3500); } else { alert('Please select a client first.'); }
					return;
				}
				
				// Open payment modal for the selected client (pass null for invoice number to show all unpaid)
				buildPaymentModal(null);
			};
			
			// Update button state based on dropdown
			updatePaymentButtonState();
		} catch (e) { console.warn('payments: failed to attach payment button handler', e); }
	}
	
	function updatePaymentButtonState() {
		try {
			const paymentBtn = document.getElementById('recordPaymentForClientBtn');
			const clientDropdown = document.getElementById('clientDropdown');
			if (!paymentBtn || !clientDropdown) return;
			
			const hasSelection = clientDropdown.value !== '' && 
				clientDropdown.options[clientDropdown.selectedIndex]?.text?.trim() !== '-- Upload CSV file first --' &&
				clientDropdown.options[clientDropdown.selectedIndex]?.text?.trim() !== '-- Select a client --';
			
			paymentBtn.disabled = !hasSelection;
		} catch (e) { console.warn('payments: failed to update button state', e); }
	}

	function wrapCalculateTotals() {
		if (window.__origCalculateTotals) return;
		window.__origCalculateTotals = window.calculateTotals;
		window.calculateTotals = function() {
			try { window.__origCalculateTotals(); } finally { const invNo = getCurrentInvoiceNumber(); if (invNo) updatePaymentSummaryUI(invNo); }
		};
	}

	function wrapShowInvoice() {
		if (window.__origShowInvoice) return;
		window.__origShowInvoice = window.showInvoice;
		window.showInvoice = function(idx) { try { window.__origShowInvoice(idx); } finally { const invNo = getCurrentInvoiceNumber(); if (invNo) updatePaymentSummaryUI(invNo); } };
	}

	function wrapUpdateUploadStatus() {
		if (!window.__origUpdateUploadStatus && typeof window.updateUploadStatus === 'function') {
			window.__origUpdateUploadStatus = window.updateUploadStatus;
		}
		window.updateUploadStatus = updateUploadStatusWrapper;
	}
	
	function wrapSelectClient() {
		if (window.__origSelectClient) return;
		if (typeof window.selectClient === 'function') {
			window.__origSelectClient = window.selectClient;
			window.selectClient = function() {
				try { window.__origSelectClient(); } finally { updatePaymentButtonState(); }
			};
		}
	}
	
	function wrapPopulateClientDropdown() {
		if (window.__origPopulateClientDropdown) return;
		if (typeof window.populateClientDropdown === 'function') {
			window.__origPopulateClientDropdown = window.populateClientDropdown;
			window.populateClientDropdown = function() {
				try { window.__origPopulateClientDropdown(); } finally { attachPaymentButtonHandler(); updatePaymentButtonState(); }
			};
		}
	}

	// ---------------------- Payment Popup ----------------------
	function renderPaymentRow(tr, invoiceInfo) {
		const invoiceNumber = invoiceInfo.invoiceNumber || '';
		const outstanding = invoiceInfo.outstanding || 0;
		tr.innerHTML = `\n      <td><strong>${invoiceNumber}</strong></td>\n      <td class="amount-col">AED ${formatNumber(outstanding)}</td>\n      <td><input type="number" step="0.01" class="pay-amount" value="${parseNumber(invoiceInfo["Amount Applied to Invoice"] || 0).toFixed(2)}" placeholder="0.00"></td>\n      <td class="actions-col">\n        <button type="button" class="remove-invoice-btn" title="Remove from payment" aria-label="Remove invoice from payment">X</button>\n        <input type="hidden" class="pay-invoice-number" value="${invoiceNumber}">\n        <input type="hidden" class="pay-outstanding" value="${outstanding.toFixed(2)}">\n      </td>\n    `;
	}

	// buildPaymentModal(invoiceNumber, prefillRows?)
	// If prefillRows is an array of payment objects, these will be appended to the existing payments
	// displayed in the modal so callers (like reports.js) can pre-fill a payment before showing it.
	function buildPaymentModal(invoiceNumber, prefillRows) {
		let customer = getCurrentCustomerName();
		
		// If no customer from UI element, try to get it from the current invoice data
		if (!customer && invoiceNumber) {
			const invRow = getInvoiceHeaderRow(invoiceNumber);
			if (invRow) {
				customer = (invRow["Customer Name"] || invRow["Client Name"] || '').trim();
			}
		}
		
		if (!customer) {
			if (typeof window.showToast === 'function') { window.showToast('No customer found. Please select an invoice with a customer first.', 'warning', 4000); } else { alert('No customer found. Please select an invoice with a customer first.'); }
			return;
		}
		
		const invDate = getCurrentInvoiceDate();
		const unpaidInvoices = getCustomerUnpaidInvoices(customer);
		
		if (unpaidInvoices.length === 0) {
			const msg = `No unpaid invoices found for customer: ${customer}\n\nThis customer may not have any invoices with status "Sent", "Draft", or "Overdue" that have outstanding balances.`;
			if (typeof window.showToast === 'function') { window.showToast(msg, 'info', 5000); } else { alert(msg); }
			return;
		}

		const overlay = document.createElement('div');
		overlay.className = 'modal-overlay';
		overlay.id = 'paymentsModalOverlay';

		const content = document.createElement('div');
		content.className = 'modal-content';

		const header = document.createElement('div');
		header.className = 'modal-header';
		header.innerHTML = `\n      <h3>Record Payment - ${customer}</h3>\n      <button class="modal-close" title="Close">&times;</button>\n    `;

		const body = document.createElement('div');
		body.className = 'modal-body';
		body.innerHTML = `
      <div class="info-grid">
        <div class="info-item"><span class="info-label">Customer</span><span class="info-value">${customer || '-'}</span></div>
        <div class="info-item"><span class="info-label">Unpaid Invoices</span><span class="info-value">${unpaidInvoices.length}</span></div>
      </div>

      <div class="global-input-grid">
        <div class="field-col">
          <label class="field-label">Payment Date:</label>
          <input type="date" id="globalPaymentDate" value="${todayISODate()}">
        </div>
        <div class="field-col">
          <label class="field-label">Total Payment Amount (AED):</label>
          <input type="number" step="0.01" id="globalPaymentAmount" placeholder="0.00">
        </div>
        <div class="field-col">
          <label class="field-label">Mode:</label>
          <select id="globalPaymentMode">
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Cheque Deposit">Cheque Deposit</option>
            <option value="Check">Check</option>
            <option value="Cash">Cash</option>
            <option value="Bank Remittance">Bank Remittance</option>
            <option value="ATM Deposit">ATM Deposit</option>
            <option value="Cash with Mr. Mahmoud">Cash with Mr. Mahmoud</option>
            <option value="Cash Payment to Mr. Mahmoud">Cash Payment to Mr. Mahmoud</option>
          </select>
        </div>
        <div class="field-col">
          <label class="field-label">Bank:</label>
          <input type="text" id="globalPaymentBank" list="paymentsBankNames" placeholder="Bank Name">
        </div>
        <div class="field-col">
          <label class="field-label">Reference:</label>
          <input type="text" id="globalPaymentReference" placeholder="Reference Number">
        </div>
      </div>

      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th class="invoice-ref">Invoice Reference</th>
              <th class="invoice-amount">Invoice Amount (AED)</th>
              <th class="amount-applied">Amount Applied (AED)</th>
              <th class="actions-header"></th>
            </tr>
          </thead>
          <tbody id="paymentsTableBody"></tbody>
        </table>
        <datalist id="paymentsBankNames">
          <option value="ADCB"></option>
          <option value="FAB"></option>
          <option value="IBS Consultancy - ENBD"></option>
          <option value="Mashreq"></option>
          <option value="RAK Bank"></option>
          <option value="Dubai Islamic Bank"></option>
          <option value="Abu Dhabi Islamic Bank"></option>
          <option value="HSBC"></option>
          <option value="Standard Chartered"></option>
          <option value="Sharjah Islamic Bank"></option>
        </datalist>
      </div>
    `;

		const actions = document.createElement('div');
		actions.className = 'form-actions';
			actions.innerHTML = `\n      <button type="button" class="cancel-btn btn" id="cancelPaymentsBtn">Cancel</button>\n      <button type="button" class="save-client-btn btn" id="savePaymentsBtn">Save</button>\n    `;

		content.appendChild(header);
		content.appendChild(body);
		content.appendChild(actions);
		overlay.appendChild(content);

		// Fill table with unpaid invoices
		const tbody = body.querySelector('#paymentsTableBody');
		let totalUnpaid = 0;
		unpaidInvoices.forEach(invInfo => {
			const tr = document.createElement('tr');
			renderPaymentRow(tr, invInfo);
			tbody.appendChild(tr);
			totalUnpaid += invInfo.outstanding || 0;
		});
		
		// Add total row at the bottom
		const totalUnpaidRow = document.createElement('tr');
		totalUnpaidRow.id = 'totalUnpaidRow';
		totalUnpaidRow.innerHTML = `
			<td>Total Unpaid:</td>
			<td id="totalUnpaidAmount">${formatNumber(totalUnpaid)}</td>
			<td id="totalAppliedAmount">0.00</td>
			<td></td>
		`;
		tbody.appendChild(totalUnpaidRow);
		
		// Function to recalculate totals
		const updateTotals = () => {
			const invoiceRows = tbody.querySelectorAll('tr:not(#totalUnpaidRow)');
			let unpaidSum = 0;
			let appliedSum = 0;
			
			invoiceRows.forEach(tr => {
				const outstanding = parseNumber(tr.querySelector('.pay-outstanding')?.value || 0);
				const applied = parseNumber(tr.querySelector('.pay-amount')?.value || 0);
				unpaidSum += outstanding;
				appliedSum += applied;
			});
			
			const totalUnpaidCell = totalUnpaidRow.querySelector('#totalUnpaidAmount');
			const totalAppliedCell = totalUnpaidRow.querySelector('#totalAppliedAmount');
			if (totalUnpaidCell) totalUnpaidCell.textContent = formatNumber(unpaidSum);
			if (totalAppliedCell) totalAppliedCell.textContent = formatNumber(appliedSum);
			
			// Update max for global payment amount
			if (globalPaymentAmountInput) {
				globalPaymentAmountInput.setAttribute('max', unpaidSum.toFixed(2));
			}
			
			return unpaidSum;
		};
		
		// Add remove button handlers
		const attachRemoveHandlers = () => {
			tbody.querySelectorAll('.remove-invoice-btn').forEach(btn => {
				btn.onclick = function() {
					const row = this.closest('tr');
					if (row) {
						row.remove();
						updateTotals();
						
						// Check if all invoices removed
						const remainingInvoices = tbody.querySelectorAll('tr:not(#totalUnpaidRow)').length;
						if (remainingInvoices === 0) {
							if (typeof window.showToast === 'function') { window.showToast('All invoices have been removed. Closing payment modal.', 'info', 3000); } else { alert('All invoices have been removed. Closing payment modal.'); }
							closePaymentsModal();
						}
					}
				};
			});
		};
		
		attachRemoveHandlers();
		
		// Add listener to update total applied amount when amounts change
		tbody.addEventListener('input', (e) => {
			if (e.target.classList.contains('pay-amount')) {
				updateTotals();
			}
		});

		// Add handlers
		header.querySelector('.modal-close').onclick = closePaymentsModal;
		actions.querySelector('#cancelPaymentsBtn').onclick = closePaymentsModal;

		// Add payment amount allocation handler with max validation
		const globalPaymentAmountInput = body.querySelector('#globalPaymentAmount');
		if (globalPaymentAmountInput) {
			globalPaymentAmountInput.addEventListener('input', () => {
				let currentMax = parseNumber(globalPaymentAmountInput.getAttribute('max') || 0);
				let totalAmount = parseNumber(globalPaymentAmountInput.value || 0);
				
				// Restrict to maximum total unpaid amount
				if (totalAmount > currentMax) {
					totalAmount = currentMax;
					globalPaymentAmountInput.value = currentMax.toFixed(2);
					if (typeof window.showNotification === 'function') {
						window.showNotification(`Payment amount cannot exceed total unpaid (${formatNumber(currentMax)})`, 'warning');
					}
				}
				
				if (totalAmount <= 0) return;
				
				let remaining = totalAmount;
				const invoiceRows = tbody.querySelectorAll('tr:not(#totalUnpaidRow)');
				
				invoiceRows.forEach((tr, index) => {
					const outstanding = parseNumber(tr.querySelector('.pay-outstanding')?.value || 0);
					const amountInput = tr.querySelector('.pay-amount');
					
					if (!amountInput) return;
					
					if (remaining <= 0) {
						amountInput.value = '0.00';
					} else if (remaining >= outstanding) {
						amountInput.value = outstanding.toFixed(2);
						remaining -= outstanding;
					} else {
						amountInput.value = remaining.toFixed(2);
						remaining = 0;
					}
				});
				
				updateTotals();
			});
		}
		
		// Initial totals calculation
		updateTotals();

		actions.querySelector('#savePaymentsBtn').onclick = () => {
			// Get the global payment inputs
			const globalDate = body.querySelector('#globalPaymentDate')?.value || todayISODate();
			const globalMode = body.querySelector('#globalPaymentMode')?.value || 'Bank Transfer';
			const globalBank = body.querySelector('#globalPaymentBank')?.value || '';
			const globalReference = body.querySelector('#globalPaymentReference')?.value || '';
			const globalTotalPayment = parseNumber(body.querySelector('#globalPaymentAmount')?.value || 0);
			
			// Collect rows
			const newPayments = [];
			const trs = tbody.querySelectorAll('tr:not(#totalUnpaidRow)');
			let totalApplied = 0;

			trs.forEach(tr => {
				const invoiceNum = tr.querySelector('.pay-invoice-number')?.value || '';
				const mode = globalMode;
				const bank = globalBank;
				const ref = globalReference;
				const amt = parseNumber(tr.querySelector('.pay-amount')?.value || 0);
				const outstanding = parseNumber(tr.querySelector('.pay-outstanding')?.value || 0);

				if (amt <= 0 || !invoiceNum) return; // skip zero/negatives or missing invoice

				totalApplied += amt;

				const newPaymentNumber = String(getNextPaymentNumber());
				const newCustPaymentID = getNextCustomerPaymentID();
				const newInvPaymentID = getNextInvoicePaymentID();

				// Calculate payment status: "Paid" if fully paid, "Partially Paid" otherwise
				const paymentStatus = (Math.abs(amt - outstanding) < 0.01) ? 'Paid' : 'Partially Paid';

				const out = {};
				PAYMENT_HEADERS.forEach(h => { out[h] = ''; });

				// Fill required fields
				out["Payment Number"] = newPaymentNumber;
				out["CustomerPayment ID"] = newCustPaymentID;
				out["Mode"] = mode;
				out["CustomerID"] = '';
				out["Description"] = '';
				out["Exchange Rate"] = '1.000000000000';
				out["Amount"] = String(globalTotalPayment.toFixed(3));  // Use global total payment amount
				out["Unused Amount"] = '0.000';
				out["Bank Charges"] = '0.000';
				out["Reference Number"] = ref;
				out["Currency Code"] = 'AED';
				out["Payment Number Prefix"] = '';
				out["Payment Number Suffix"] = '';
				out["Customer Name"] = customer;
				out["Payment Type"] = 'Invoice Payment';
				out["Date"] = globalDate;
				out["Created Time"] = new Date().toISOString().replace('T', ' ').substring(0, 19);
				out["Deposit To"] = bank;
				out["Deposit To Account Code"] = '';
				out["Bank Name"] = bank;
				out["Payment Status"] = paymentStatus;
				out["InvoicePayment ID"] = newInvPaymentID;
				out["Amount Applied to Invoice"] = String(amt.toFixed(2));  // Use individual invoice amount
				out["Invoice Payment Applied Date"] = globalDate;
				out["Invoice Number"] = invoiceNum;
				
				// Get invoice date from the invoice
				const invHeader = getInvoiceHeaderRow(invoiceNum);
				out["Invoice Date"] = invHeader ? (invHeader["Invoice Date"] || globalDate) : globalDate;

				newPayments.push(out);
			});

			if (newPayments.length === 0) {
				if (typeof window.showToast === 'function') { window.showToast('No payments to save. Please enter amounts greater than 0.', 'warning', 3500); } else { alert('No payments to save. Please enter amounts greater than 0.'); }
				return;
			}

			// Add new payments to paymentsData
			window.paymentsData = window.paymentsData || [];
			window.paymentsData.push(...newPayments);

			// Check each invoice and update status to "Closed" if fully paid
			const invoicesProcessed = new Set();
			newPayments.forEach(payment => {
				const invNum = payment['Invoice Number'];
				//console.log('ðŸ” Checking payment for invoice:', invNum);
				
				if (!invNum || invoicesProcessed.has(invNum)) return;
				invoicesProcessed.add(invNum);

				// Calculate total for this invoice
				const invoiceRows = (window.allInvoices || []).filter(r => 
					String(r['Invoice Number']||'').trim() === String(invNum).trim()
				);
				//console.log('ðŸ“„ Found invoice rows:', invoiceRows.length);
				
				if (!invoiceRows.length) return;

				// Get invoice total from Total column
				let invoiceTotal = 0;
				for (const row of invoiceRows) {
					const total = parseFloat(row['Total'] || 0);
					if (!isNaN(total) && total > 0) {
						invoiceTotal = total;
						break;
					}
				}
				console.log('ðŸ’° Invoice Total:', invoiceTotal);

				// Calculate total paid for this invoice (including the new payment being saved)
				const allPaymentsForInvoice = (window.paymentsData || []).filter(p => 
					String(p['Invoice Number']||'').trim() === String(invNum).trim()
				);
				const totalPaid = allPaymentsForInvoice.reduce((sum, p) => {
					const amt = parseFloat(p['Amount Applied to Invoice'] || p['Amount'] || 0);
					return sum + (isNaN(amt) ? 0 : amt);
				}, 0);
				console.log('ðŸ’µ Total Paid:', totalPaid, '(from', allPaymentsForInvoice.length, 'payments)');

				// If fully paid, update invoice status to "Closed"
				if (totalPaid >= invoiceTotal && invoiceTotal > 0) {
					console.log('âœ… UPDATING INVOICE STATUS TO CLOSED');
					invoiceRows.forEach(row => {
						console.log('  - Updating row with Invoice Number:', row['Invoice Number'], 'Old Status:', row['Invoice Status']);
						row['Invoice Status'] = 'Closed';
						row['Status'] = 'Closed';
						console.log('  - New Status:', row['Invoice Status']);
					});
					console.log(`âœ… Invoice ${invNum} marked as Closed (Total: ${invoiceTotal}, Paid: ${totalPaid})`);
				} else {
					console.log('âš ï¸ Invoice not fully paid. Total:', invoiceTotal, 'Paid:', totalPaid, 'Remaining:', invoiceTotal - totalPaid);
				}
			});

			// Save updated invoice data
			if (window.invoiceStorageManager && typeof window.invoiceStorageManager.saveInvoicesToStorage === 'function') {
				window.invoiceStorageManager.saveInvoicesToStorage();
			}

			savePaymentsToLocalStorage();
			
			// Sync to Google Sheets Customer Payments
			(async () => {
				try {
					if (window.ServiceAccountAuth && typeof window.ServiceAccountAuth.fetch === 'function') {
						const SPREADSHEET_ID = window.GOOGLE_SPREADSHEET_ID || '17gh8MZSeFVPQudyTGwYf5_pFWH8yt-xpCPiPy9i8x-U';
						const SHEET_NAME = 'Customer Payments';
						const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_NAME}!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
						
						// Build rows following Columns index.csv structure (columns 0-24):
						// 0: Payment Number (if exists)
						// 1: CustomerPayment ID, 2: Mode, 3: CustomerID, 4: Description, 5: Exchange Rate
						// 6: Amount, 7: Unused Amount, 8: Bank Charges, 9: Reference Number, 10: Currency Code
						// 11: Payment Number Prefix, 12: Payment Number Suffix, 13: Customer Name, 14: Payment Type
						// 15: Date, 16: Created Time, 17: Deposit To, 18: Deposit To Account Code, 19: Payment Status
						// 20: InvoicePayment ID, 21: Amount Applied to Invoice, 22: Invoice Payment Applied Date
						// 23: Invoice Number, 24: Invoice Date
						const rows = newPayments.map(p => [
							p["Payment Number"] || '',              // 0
							p["CustomerPayment ID"] || '',          // 1
							p["Mode"] || '',                        // 2
							p["CustomerID"] || '',                  // 3
							p["Description"] || '',                 // 4
							p["Exchange Rate"] || '',               // 5
							p["Amount"] || '',                      // 6
							p["Unused Amount"] || '',               // 7
							p["Bank Charges"] || '',                // 8
							p["Reference Number"] || '',            // 9
							p["Currency Code"] || '',               // 10
							p["Payment Number Prefix"] || '',       // 11
							p["Payment Number Suffix"] || '',       // 12
							p["Customer Name"] || '',               // 13
							p["Payment Type"] || '',                // 14
							p["Date"] || '',                        // 15
							p["Created Time"] || '',                // 16
							p["Deposit To"] || '',                  // 17
							p["Deposit To Account Code"] || '',     // 18
							p["Payment Status"] || '',              // 19
							p["InvoicePayment ID"] || '',           // 20
							p["Amount Applied to Invoice"] || '',   // 21
							p["Invoice Payment Applied Date"] || '',// 22
							p["Invoice Number"] || '',              // 23
							p["Invoice Date"] || ''                 // 24
						]);
						
						await window.ServiceAccountAuth.fetch(appendUrl, { 
							method: 'POST', 
							body: JSON.stringify({ values: rows }) 
						});
						console.log(`Appended ${rows.length} payment(s) to Customer Payments sheet`);
					}
				} catch (e) { 
					console.warn('Failed to append payments to Google Sheets', e); 
				}
				
				// Sync invoice status updates to Google Sheets if any invoices were closed
				if (invoicesProcessed.size > 0 && window.ServiceAccountAuth && typeof window.ServiceAccountAuth.fetch === 'function') {
					const SPREADSHEET_ID = window.GOOGLE_SPREADSHEET_ID || '17gh8MZSeFVPQudyTGwYf5_pFWH8yt-xpCPiPy9i8x-U';
					const SHEET_NAME = 'Invoices';
					
					// Update each closed invoice in Google Sheets
					for (const invNum of invoicesProcessed) {
						try {
							const invoiceRows = (window.allInvoices || []).filter(r => 
								String(r['Invoice Number']||'').trim() === String(invNum).trim()
							);
							
							// Check if this invoice was marked as Closed
							if (invoiceRows.length > 0 && invoiceRows[0]['Invoice Status'] === 'Closed') {
								//console.log(`ðŸ”„ Syncing invoice ${invNum} status to Google Sheets: Closed`);
								
								// Read all data from the Invoices sheet to find row numbers
								const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_NAME}!A:Z`;
								//console.log(`ðŸ“¡ Reading from: ${readUrl}`);
								
								const response = await window.ServiceAccountAuth.fetch(readUrl);
								const sheetData = await response.json();
								//console.log(`ðŸ“¥ API Response:`, sheetData);
								
								if (!sheetData || !sheetData.values) {
									console.error('âŒ Failed to read sheet data or empty response');
									console.error('Response object:', sheetData);
									continue; // Skip this invoice
								}
								
								const rows = sheetData.values || [];
								
								//console.log(`ðŸ“Š Total rows in sheet: ${rows.length}`);
								console.log(`ðŸ”Ž Looking for invoice: "${invNum}"`);
								
								// Find all rows for this invoice (Invoice Number is column B, index 1)
								const rowsToUpdate = [];
								rows.forEach((row, index) => {
									if (index === 0) return; // Skip header
									const sheetInvNum = String(row[1] || '').trim();
									const targetInvNum = String(invNum || '').trim();
									
									// Debug first few rows
									if (index < 5) {
										console.log(`Row ${index + 1}: Invoice Number in sheet = "${sheetInvNum}"`);
									}
									
									if (sheetInvNum === targetInvNum) {
										console.log(`âœ“ Found matching row ${index + 1}: "${sheetInvNum}"`);
										rowsToUpdate.push(index + 1); // +1 for 1-based row numbering
									}
								});
								
								console.log(`Found ${rowsToUpdate.length} rows to update for invoice ${invNum}`);
								
								// Update Invoice Status column (column C, index 2) to "Closed"
								for (const rowNum of rowsToUpdate) {
									const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_NAME}!C${rowNum}?valueInputOption=USER_ENTERED`;
									await window.ServiceAccountAuth.fetch(updateUrl, {
										method: 'PUT',
										body: JSON.stringify({ values: [['Closed']] })
									});
									console.log(`âœ… Updated row ${rowNum} to Closed`);
								}
							}
						} catch (e) {
							console.warn(`Failed to sync invoice ${invNum} status to Google Sheets`, e);
						}
					}
				}
			})();
			
			// Update the current invoice if we're on one
			const currentInv = getCurrentInvoiceNumber();
			if (currentInv) {
				updatePaymentSummaryUI(currentInv);
				// Refresh the invoice display to show updated status
				if (typeof window.showInvoice === 'function' && typeof window.currentInvoiceIndex === 'number') {
					window.showInvoice(window.currentInvoiceIndex);
				}
			}
			
			// Refresh reports modal if open
			if (typeof window.refreshReportsModal === 'function') {
				try {
					const reportsModal = document.getElementById('reportsModal');
					if (reportsModal && reportsModal.style.display === 'flex') {
						window.refreshReportsModal();
					}
				} catch(e) {}
			}

			try {
				const paidMsg = `✅ Payments saved — ${newPayments.length} payment(s), AED ${formatNumber(totalApplied)} applied`;
				if (typeof window.showAnchoredTooltip === 'function') {
					window.showAnchoredTooltip(paidMsg, 'invoiceNumber', 4000);
				} else if (typeof window.showToast === 'function') {
					window.showToast(paidMsg, 'success', 4000);
				} else {
					console.log(paidMsg);
				}
			} catch (e) { console.warn('Failed to show payment saved tooltip', e); }

			closePaymentsModal();
		};

		// Insert overlay
		document.body.appendChild(overlay);
		document.body.style.overflow = 'hidden';
	}

	function closePaymentsModal() { const ov = document.getElementById('paymentsModalOverlay'); if (ov) ov.remove(); document.body.style.overflow = 'auto'; }

	// Expose RecordPayment called by your existing button
	window.RecordPayment = function() { const invNo = getCurrentInvoiceNumber(); if (!invNo) { if (typeof window.showToast === 'function') { window.showToast('Please select or load an invoice first.', 'warning', 3500); } else { alert('Please select or load an invoice first.'); } return; } buildPaymentModal(invNo); };

	// ADD HERE â€” just before the closing "})();"
	window.generatePaymentsCSVString = function() {
		const data = window.paymentsData || [];
		const headerLine = PAYMENT_HEADERS.join(',');
		const rows = data.map(csvRowFromPayment);
		return [headerLine, ...rows].join('\n');
	};

	window.savePaymentsToLocalStorage = savePaymentsToLocalStorage;

	function computeInvoiceTotalFromDB(invoiceNumber) {
		const rows = (window.allInvoices || []).filter(r => (r["Invoice Number"] || '').trim() === (invoiceNumber || '').trim());
		if (!rows || !rows.length) return 0;
		
		// Try to use the Total field from the header row first
		const headerRow = rows[0];
		if (headerRow && headerRow["Total"] !== undefined && headerRow["Total"] !== '') {
			const totalVal = parseNumber(headerRow["Total"]);
			if (totalVal > 0) return Math.round(totalVal * 100) / 100;
		}
		
		// Fallback: sum up item totals
		let total = 0; 
		rows.forEach(r => { 
			const itemTotal = parseNumber(r["Item Total"] || 0);
			const taxable = parseNumber(r["Taxable Amount"] || 0);
			const tax = parseNumber(r["Item Tax Amount"] || r["Item Tax"] || 0);
			
			// Use Item Total if available, otherwise calculate from taxable + tax
			if (itemTotal > 0) {
				total += itemTotal;
			} else {
				total += taxable + tax;
			}
		}); 
		// Round to 2 decimal places to avoid floating point precision issues
		return Math.round(total * 100) / 100;
	}

	function getInvoiceHeaderRow(invoiceNumber) { return (window.allInvoices || []).find(r => (r["Invoice Number"] || '').trim() === (invoiceNumber || '').trim()) || null; }

	function parseInvNumeric(ref) { const m = String(ref || '').match(/(\d+)/); return m ? parseInt(m[1], 10) : 0; }

	function getISODateSafe(d) { if (typeof window.normalizeDateForInput === 'function') { const iso = window.normalizeDateForInput(d); return iso || ''; } const dt = new Date(d); return isNaN(dt) ? '' : dt.toISOString().slice(0, 10); }

	function getCustomerUnpaidInvoices(customerName, excludeInvoiceNumber) {
		const name = String(customerName || '').trim().toLowerCase(); 
		if (!name) {
			console.warn('getCustomerUnpaidInvoices: No customer name provided');
			return [];
		}
		
		const seen = new Set(); 
		const byInv = new Map();
		const UNPAID_STATUSES = ['sent', 'draft', 'overdue'];
		
		console.log('getCustomerUnpaidInvoices: Looking for customer:', customerName);
		console.log('Total invoices in window.allInvoices:', (window.allInvoices || []).length);
		
		(window.allInvoices || []).forEach(r => { 
			const invNo = (r["Invoice Number"] || '').trim(); 
			const cust = (r["Customer Name"] || '').trim().toLowerCase(); 
			
			if (!invNo || cust !== name) return; 
			
			if (!seen.has(invNo)) { 
				seen.add(invNo); 
				const total = computeInvoiceTotalFromDB(invNo); 
				const paid = getTotalPaidForInvoice(invNo); 
				// Round to 2 decimal places to avoid floating point precision issues
				const outstanding = Math.max(Math.round((total - paid) * 100) / 100, 0); 
				const hdr = getInvoiceHeaderRow(invNo) || {}; 
				const invDateISO = getISODateSafe(hdr["Invoice Date"]) || ''; 
				const status = String(hdr["Invoice Status"] || hdr["Status"] || '').trim().toLowerCase();
				
				//console.log('Invoice:', invNo, '| Status:', status, '| Total:', total, '| Paid:', paid, '| Outstanding:', outstanding);
				
				byInv.set(invNo, { invoiceNumber: invNo, invoiceDateISO: invDateISO, invoiceDateRaw: hdr["Invoice Date"] || '', total, paid, outstanding, status }); 
			} 
		});
		
		const list = Array.from(byInv.values()).filter(x => {
			if (x.invoiceNumber === excludeInvoiceNumber) {
				//console.log('Excluding invoice (matches excludeInvoiceNumber):', x.invoiceNumber);
				return false;
			}
			if (x.outstanding <= 0) {
				//console.log('Excluding invoice (no outstanding balance):', x.invoiceNumber, '| Outstanding:', x.outstanding);
				return false;
			}
			// Only include invoices with unpaid statuses (sent, draft, overdue)
			if (x.status && !UNPAID_STATUSES.includes(x.status)) {
				//console.log('Excluding invoice (status not unpaid):', x.invoiceNumber, '| Status:', x.status);
				return false;
			}
			//console.log('Including invoice:', x.invoiceNumber);
			return true;
		});
		
		//console.log('getCustomerUnpaidInvoices: Returning', list.length, 'unpaid invoices');
		
		list.sort((a,b) => { const aTime = a.invoiceDateISO ? new Date(a.invoiceDateISO).getTime() : 0; const bTime = b.invoiceDateISO ? new Date(b.invoiceDateISO).getTime() : 0; if (aTime !== bTime) return aTime - bTime; return parseInvNumeric(a.invoiceNumber) - parseInvNumeric(b.invoiceNumber); });
		return list;
	}

	function addCreditToClient(customerName, creditDelta) { const name = String(customerName || '').trim().toLowerCase(); if (!name || !creditDelta || creditDelta <= 0) return; const idx = Array.isArray(window.clientsData) ? window.clientsData.findIndex(c => { const existingName = c['Display Name'] || c['Client Name'] || c['Name'] || c['name'] || c['CLIENT NAME'] || c['client_name'] || ''; return String(existingName).trim().toLowerCase() === name; }) : -1; if (idx >= 0) { const client = window.clientsData[idx]; const currentCredit = parseNumber(client['Credit'] || 0); client['Credit'] = (currentCredit + creditDelta).toFixed(2); console.log('addCreditToClient: clients persistence disabled, not saving to localStorage'); } else { console.warn('Client not found to add credit:', customerName, 'Credit:', creditDelta); } }

	// expose a namespaced object for tests and external code
	window.paymentManager = {
		loadPaymentsFromLocalStorage,
		savePaymentsToLocalStorage,
		getPaymentsForInvoice,
		getTotalPaidForInvoice,
		updatePaymentSummaryUI,
		updatePaymentButtonState,
		exportPaymentsCSV: window.exportPaymentsCSV,
		loadpaymnetCSVfile: window.loadpaymnetCSVfile,
		generatePaymentsCSVString: window.generatePaymentsCSVString,
		getCustomerUnpaidInvoices,
		addCreditToClient,
		buildPaymentModal,
		renderPaymentRow,
		closePaymentsModal,
		getNextPaymentNumber,
		getNextInvoicePaymentID,
		getNextCustomerPaymentID
	};

	// DOM ready initialization
	document.addEventListener('DOMContentLoaded', function() {
		loadPaymentsFromLocalStorage();
		wrapCalculateTotals();
		wrapShowInvoice();
		wrapUpdateUploadStatus();
		wrapSelectClient();
		wrapPopulateClientDropdown();
		attachPaymentButtonHandler();
		const invNo = (document.getElementById('invoiceNumber') && document.getElementById('invoiceNumber').value) || '';
		if (invNo) updatePaymentSummaryUI(invNo);
		updateUploadStatusWrapper();
	});

	// Backwards compatibility -- ensure window.updatePaymentSummaryUI referenced by other modules remains available
	window.updatePaymentSummaryUI = updatePaymentSummaryUI;

	// Provide legacy global helpers expected by older code
	window.getNextPaymentNumber = window.getNextPaymentNumber || getNextPaymentNumber;
	window.getNextInvoicePaymentID = window.getNextInvoicePaymentID || getNextInvoicePaymentID;
	window.getNextCustomerPaymentID = window.getNextCustomerPaymentID || getNextCustomerPaymentID;
	// Also export into the environment global so older code that references
	// unqualified globals (getNextPaymentNumber) continues to work in tests
	try {
		if (typeof global !== 'undefined') {
			global.getNextPaymentNumber = global.getNextPaymentNumber || getNextPaymentNumber;
			global.getNextInvoicePaymentID = global.getNextInvoicePaymentID || getNextInvoicePaymentID;
			global.getNextCustomerPaymentID = global.getNextCustomerPaymentID || getNextCustomerPaymentID;
		}
	} catch (e) { /* ignore */ }

})();


