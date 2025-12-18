/* Payment CSV - CSV import/export functionality */
(function(){
	'use strict';

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

	const savePaymentsToLocalStorage = window.paymentStorage?.savePaymentsToLocalStorage;
	const updateUploadStatusWrapper = window.paymentUI?.updateUploadStatusWrapper;
	const updatePaymentSummaryUI = window.paymentUI?.updatePaymentSummaryUI;
	const getCurrentInvoiceNumber = window.paymentHelpers?.getCurrentInvoiceNumber;

	function csvRowFromPayment(p) {
		return PAYMENT_HEADERS.map(h => {
			const v = p[h] ?? '';
			const escaped = String(v).replace(/"/g, '""');
			return `"${escaped}"`;
		}).join(',');
	}

	function loadpaymnetCSVfile(event) {
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
	}

	function exportPaymentsCSV() {
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
	}

	function generatePaymentsCSVString() {
		const data = window.paymentsData || [];
		const headerLine = PAYMENT_HEADERS.join(',');
		const rows = data.map(csvRowFromPayment);
		return [headerLine, ...rows].join('\n');
	}

	// Expose to window
	window.paymentCSV = {
		loadpaymnetCSVfile,
		exportPaymentsCSV,
		generatePaymentsCSVString,
		PAYMENT_HEADERS
	};

	window.loadpaymnetCSVfile = loadpaymnetCSVfile;
	window.exportPaymentsCSV = exportPaymentsCSV;
	window.generatePaymentsCSVString = generatePaymentsCSVString;

	console.log('✅ payment_csv.js loaded');
})();
