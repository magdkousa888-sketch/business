global.window = {};
// enable debug hooks in reports.js to help diagnose inference / mapping
window.DEBUG_REPORTS = true;
require('../js/ui-elements/globals.js');
const { JSDOM } = require('jsdom');
const dom = new JSDOM(`<!doctype html><html><body>
  <select id="reportsClientSelect"></select>
  <table><tbody id="reportsResultsTBody"></tbody></table>
  <div id="reports_total"></div><div id="reports_paid"></div><div id="reports_outstanding"></div>
</body></html>`);
global.document = dom.window.document;
require('../js/report-control/reports.js');

// Create test rows from Invoice.cleaned.csv sample (canonical columns)
const rows = [
  {
    'Invoice Number': 'INV100',
    'Customer Name': 'Sample Co',
    'Item Desc': 'Consultation against Ancient Builders (Arrest Warrant Memo against the manager)',
    'Quantity': '1',
    'Discount Amount': '0',
    'Item Price': '1020',
    'Item Tax Amount': '51',
    'Invoice Status': 'Sent'
  },
  
  {
    'Invoice Number': 'INV100',
    'Customer Name': 'Sample Co',
    'Item Desc': 'Consultation against Ancient Builders (Assets Seizure)',
    'Quantity': '1',
    'Discount Amount': '0',
    'Item Price': '250',
    'Item Tax Amount': '12.5',
    'Invoice Status': 'Sent'
  }
    ,
  // A badly formed row: Item Price saved as 1, but explicit Total shows real amount 1,071 and tax 51
  {
    'Invoice Number': 'INV200',
    'Customer Name': 'SampleCo2',
    'Item Desc': 'Weird row with wrong price',
    'Quantity': '1',
    'Discount Amount': '0',
    'Item Price': '1',
    'Item Tax Amount': '51',
    'Total': '1,071.00',
    'Invoice Status': 'Sent'
  }

  // Another malformed row: no Item Price column, but 'Amount' contains the explicit per-line total
  // (this used to be picked up as the per-unit price by mistake). We expect the code to infer the per-unit
  // price from the explicit total so price becomes 1,020.00 (for qty 1, tax 51 => 1020 + 51 = 1071).
  ,{
    'Invoice Number': 'INV300',
    'Customer Name': 'SampleCo3',
    'Item Desc': 'Row using Amount but missing Item Price',
    'Quantity': '1',
    'Discount Amount': '0',
    // deliberately missing 'Item Price'
    'Item Tax Amount': '51',
    'Amount': '1,071.00',
    'Invoice Status': 'Sent'
  }
];

window.allInvoices = rows;
window.paymentsData = [];

// client select
const sel = document.getElementById('reportsClientSelect');
const opt = document.createElement('option'); opt.value='__ALL__'; opt.textContent='All clients'; sel.appendChild(opt);

// Execute
window.refreshReportsModal();
const tbody = document.getElementById('reportsResultsTBody');
console.log('RESULTS HTML:\n', tbody.innerHTML);
// Look for rendered price, discount, tax total in the inner table
const detail = tbody.querySelector('.reports-details');
if (detail) {
  // There may be multiple detail tables (one per invoice). Inspect each in turn and report rows
  detail.ownerDocument.querySelectorAll('.reports-details').forEach((det, idx) => {
    const inner = det.querySelector('table tbody');
    if (!inner) return;
    // Log all rows in the inner tbody
    inner.querySelectorAll('tr').forEach(r => {
      const cols = Array.from(r.querySelectorAll('td')).map(td => td.textContent.trim());
      console.log('DETAIL ROW:', cols);
    });
  });
  // Quick assertions for the last malformed row (INV300): expected price inferred to 1,020.00
  // Find the row that contains the 'Row using Amount but missing Item Price' description
  const found = Array.from(document.querySelectorAll('.reports-details table tbody tr'))
    .find(r => r.querySelector('td') && r.querySelector('td').textContent.indexOf('Row using Amount but missing Item Price') !== -1);
  if (found) {
    const price = found.querySelector('td:nth-child(3)').textContent.trim();
    const total = found.querySelector('td:nth-child(6)').textContent.trim();
    console.log('INV300 -> price:', price, ' total:', total);
    if (price === total) {
      console.error('ERROR: price equals total which indicates the code picked the total as the price fallback.');
      process.exitCode = 2; // indicate failure
    }
    if (price !== '1,020.00') {
      console.error('ERROR: price was not inferred correctly for INV300 — expected 1,020.00 found', price);
      process.exitCode = 3;
    }
  }
} else {
  console.log('NO DETAILS ROW');
}
