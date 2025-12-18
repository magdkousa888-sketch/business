const { JSDOM } = require('jsdom');

const dom = new JSDOM(`<!doctype html><html><body>
	<select id="reportsClientSelect"></select>
	<table><tbody id="reportsResultsTBody"></tbody></table>
	<div id="reports_total"></div><div id="reports_paid"></div><div id="reports_outstanding"></div>
</body></html>`);

global.window = dom.window;
global.document = dom.window.document;

// make simple alerts and confirm available inside test environment
window.confirm = () => true;
window.alert = () => {};

// load globals then reports module
require('../js/ui-elements/globals.js');
// load payment manager so the modal builder is available
require('../js/payment-conrol/payment_manager.js');
require('../js/report-control/reports.js');

// Setup a minimal unpaid invoice
window.allInvoices = [
	{ 'Invoice Number': 'INV-TEST-100', 'Customer Name': 'UnitTest Co', 'Item Price': '100', 'Quantity': '1', 'Item Tax Amount': '0', 'Invoice Status': 'Sent', 'Invoice Date': '2025-10-01', 'Due Date': '2025-10-15' }
];
window.paymentsData = [];

// Populate modal
window.populateReportsClientSelect();
window.refreshReportsModal();

const tbody = document.getElementById('reportsResultsTBody');
console.log('Rendered reports HTML ->', tbody.innerHTML.slice(0, 300));

const markBtn = tbody.querySelector('.reports-mark-paid');
if (!markBtn) {
	console.error('Mark Paid button not found');
	process.exitCode = 1;
} else {
	console.log('Found Mark Paid button for', markBtn.dataset.inv);
	// Simulate click
	markBtn.click();

	// Validate modal opened with a prefilled payment row for the outstanding amount
	setTimeout(()=>{
		const overlay = document.getElementById('paymentsModalOverlay');
		if (!overlay) {
			console.error('FAIL: payments modal did not open');
			process.exitCode = 2;
			return;
		}
		// table row should be present and amount field should equal outstanding (100.00)
		const amountInput = overlay.querySelector('.pay-amount');
		if (!amountInput) { console.error('FAIL: amount input not found in modal'); process.exitCode = 3; return; }
		const val = parseFloat(amountInput.value || amountInput.textContent || 0);
		if (Math.abs(val - 100) > 0.01) { console.error('FAIL: expected prefilled amount 100 got', val); process.exitCode = 4; return; }
		console.log('Mark Paid handler opened payment modal with prefilled amount');
	}, 40);

// give test runner a moment to finish async checks
setTimeout(()=>{}, 60);
}
