/* Payment UI - UI updates and status management */
(function(){
	'use strict';

	const parseNumber = window.paymentHelpers?.parseNumber || function(n) {
		if (n === null || n === undefined) return 0;
		const s = String(n).replace(/,/g, '').trim();
		const v = parseFloat(s);
		return isNaN(v) ? 0 : v;
	};

	const formatNumber = window.paymentHelpers?.formatNumber || function(n) {
		const num = parseFloat(n || 0);
		return num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	};

	const getGrandTotalNumber = window.paymentHelpers?.getGrandTotalNumber;
	const getPaymentsForInvoice = window.paymentCalculations?.getPaymentsForInvoice;
	const getTotalPaidForInvoice = window.paymentCalculations?.getTotalPaidForInvoice;

	function updatePaymentSummaryUI(invoiceNumber) {
		const total = getTotalPaidForInvoice(invoiceNumber);
		const grand = getGrandTotalNumber();
		const paidSpan = document.getElementById('balanceDue');
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
					return `/ ${d} / ${formatNumber(a)}${details.length ? ` (${details.join(', ')})` : ''}`;
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
				if (typeof window.paymentModal?.buildPaymentModal === 'function') {
					window.paymentModal.buildPaymentModal(null);
				}
			};
			
			// Update button state based on dropdown
			updatePaymentButtonState();
		} catch (e) { 
			console.warn('payments: failed to attach payment button handler', e); 
		}
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
		} catch (e) { 
			console.warn('payments: failed to update button state', e); 
		}
	}

	// Expose to window
	window.paymentUI = {
		updatePaymentSummaryUI,
		bumpUploadStatus,
		updateUploadStatusWrapper,
		attachPaymentButtonHandler,
		updatePaymentButtonState
	};

	window.updatePaymentSummaryUI = updatePaymentSummaryUI;

	console.log('✅ payment_ui.js loaded');
})();
