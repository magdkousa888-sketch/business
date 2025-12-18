/* Payment Calculations - Payment computations and invoice queries */
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

	const computeInvoiceTotalFromDB = window.paymentHelpers?.computeInvoiceTotalFromDB;
	const getISODateSafe = window.paymentHelpers?.getISODateSafe;
	const getInvoiceHeaderRow = window.paymentHelpers?.getInvoiceHeaderRow;
	const parseInvNumeric = window.paymentHelpers?.parseInvNumeric;

	function getPaymentsForInvoice(invoiceNumber) {
		if (!invoiceNumber) return [];
		return (window.paymentsData || []).filter(r => 
			(r["Invoice Number"] || '').trim() === invoiceNumber
		);
	}

	function getTotalPaidForInvoice(invoiceNumber) {
		return getPaymentsForInvoice(invoiceNumber).reduce((sum, r) => {
			return sum + parseNumber(r["Amount Applied to Invoice"]);
		}, 0);
	}

	function getCustomerUnpaidInvoices(customerName, excludeInvoiceNumber) {
		const name = String(customerName || '').trim().toLowerCase(); 
		if (!name) {
			console.warn('getCustomerUnpaidInvoices: No customer name provided');
			return [];
		}
		
		const seen = new Set(); 
		const byInv = new Map();
		const UNPAID_STATUSES = ['sent', 'draft', 'overdue'];
		
		(window.allInvoices || []).forEach(r => { 
			const invNo = (r["Invoice Number"] || '').trim(); 
			const cust = (r["Customer Name"] || '').trim().toLowerCase(); 
			
			if (!invNo || cust !== name) return; 
			
			if (!seen.has(invNo)) { 
				seen.add(invNo); 
				const total = computeInvoiceTotalFromDB(invNo); 
				const paid = getTotalPaidForInvoice(invNo); 
				const outstanding = Math.max(Math.round((total - paid) * 100) / 100, 0); 
				const hdr = getInvoiceHeaderRow(invNo) || {}; 
				const invDateISO = getISODateSafe(hdr["Invoice Date"]) || ''; 
				const status = String(hdr["Invoice Status"] || hdr["Status"] || '').trim().toLowerCase();
				
				byInv.set(invNo, { 
					invoiceNumber: invNo, 
					invoiceDateISO: invDateISO, 
					invoiceDateRaw: hdr["Invoice Date"] || '', 
					total, 
					paid, 
					outstanding, 
					status 
				}); 
			} 
		});
		
		const list = Array.from(byInv.values()).filter(x => {
			if (x.invoiceNumber === excludeInvoiceNumber) return false;
			if (x.outstanding <= 0) return false;
			if (x.status && !UNPAID_STATUSES.includes(x.status)) return false;
			return true;
		});
		
		list.sort((a,b) => { 
			const aTime = a.invoiceDateISO ? new Date(a.invoiceDateISO).getTime() : 0; 
			const bTime = b.invoiceDateISO ? new Date(b.invoiceDateISO).getTime() : 0; 
			if (aTime !== bTime) return aTime - bTime; 
			return parseInvNumeric(a.invoiceNumber) - parseInvNumeric(b.invoiceNumber); 
		});
		
		return list;
	}

	function addCreditToClient(customerName, creditDelta) { 
		const name = String(customerName || '').trim().toLowerCase(); 
		if (!name || !creditDelta || creditDelta <= 0) return; 
		
		const idx = Array.isArray(window.clientsData) ? window.clientsData.findIndex(c => { 
			const existingName = c['Display Name'] || c['Client Name'] || c['Name'] || c['name'] || 
				c['CLIENT NAME'] || c['client_name'] || ''; 
			return String(existingName).trim().toLowerCase() === name; 
		}) : -1; 
		
		if (idx >= 0) { 
			const client = window.clientsData[idx]; 
			const currentCredit = parseNumber(client['Credit'] || 0); 
			client['Credit'] = (currentCredit + creditDelta).toFixed(2); 
			console.log('addCreditToClient: clients persistence disabled, not saving to localStorage'); 
		} else { 
			console.warn('Client not found to add credit:', customerName, 'Credit:', creditDelta); 
		} 
	}

	// Expose to window
	window.paymentCalculations = {
		getPaymentsForInvoice,
		getTotalPaidForInvoice,
		getCustomerUnpaidInvoices,
		addCreditToClient
	};

	console.log('✅ payment_calculations.js loaded');
})();
