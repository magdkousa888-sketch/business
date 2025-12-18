/* Payment Helpers - Utility functions for payment management */
(function(){
	'use strict';

	// ---------------------- Number and Date Helpers ----------------------
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

	function getISODateSafe(d) { 
		if (typeof window.normalizeDateForInput === 'function') { 
			const iso = window.normalizeDateForInput(d); 
			return iso || ''; 
		} 
		const dt = new Date(d); 
		return isNaN(dt) ? '' : dt.toISOString().slice(0, 10); 
	}

	function parseInvNumeric(ref) { 
		const m = String(ref || '').match(/(\d+)/); 
		return m ? parseInt(m[1], 10) : 0; 
	}

	// ---------------------- Invoice Data Helpers ----------------------
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

	function getInvoiceHeaderRow(invoiceNumber) { 
		return (window.allInvoices || []).find(r => 
			(r["Invoice Number"] || '').trim() === (invoiceNumber || '').trim()
		) || null; 
	}

	function computeInvoiceTotalFromDB(invoiceNumber) {
		const rows = (window.allInvoices || []).filter(r => 
			(r["Invoice Number"] || '').trim() === (invoiceNumber || '').trim()
		);
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

	// ---------------------- ID Generators ----------------------
	function getNextPaymentNumber() {
		const nums = (window.paymentsData || [])
			.map(r => parseInt(r["Payment Number"], 10))
			.filter(n => !isNaN(n));
		const max = nums.length ? Math.max(...nums) : 0;
		return max + 1;
	}

	function getNextInvoicePaymentID() { 
		return 'loc-invpay-' + Date.now() + '-' + Math.floor(Math.random() * 100000); 
	}
	
	function getNextCustomerPaymentID() { 
		return 'loc-custpay-' + Date.now() + '-' + Math.floor(Math.random() * 100000); 
	}

	// Expose to window
	window.paymentHelpers = {
		parseNumber,
		formatNumber,
		nowISO,
		todayISODate,
		getISODateSafe,
		parseInvNumeric,
		getCurrentInvoiceNumber,
		getCurrentCustomerName,
		getCurrentInvoiceDate,
		getGrandTotalNumber,
		getInvoiceHeaderRow,
		computeInvoiceTotalFromDB,
		getNextPaymentNumber,
		getNextInvoicePaymentID,
		getNextCustomerPaymentID
	};

	// Legacy global exports
	window.getNextPaymentNumber = getNextPaymentNumber;
	window.getNextInvoicePaymentID = getNextInvoicePaymentID;
	window.getNextCustomerPaymentID = getNextCustomerPaymentID;

	console.log('✅ payment_helpers.js loaded');
})();
