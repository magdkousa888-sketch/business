/* Payment Storage - LocalStorage persistence for payments */
(function(){
	'use strict';

	const LS_KEY_PAYMENTS = 'invoiceApp_paymentsData';
	const LS_KEY_PAYMENTS_LAST = 'invoiceApp_paymentsLastSaved';

	// Ensure globals exist
	window.paymentsData = window.paymentsData || [];
	window.paymentFileUploaded = window.paymentFileUploaded || false;

	function nowISO() {
		return new Date().toISOString();
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
		if (window.dataLoader && typeof window.dataLoader.loadPaymentsFromLocalStorage === 'function') 
			return window.dataLoader.loadPaymentsFromLocalStorage();
		
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

	// Expose to window
	window.paymentStorage = {
		savePaymentsToLocalStorage,
		loadPaymentsFromLocalStorage
	};

	window.savePaymentsToLocalStorage = savePaymentsToLocalStorage;

	console.log('✅ payment_storage.js loaded');
})();
