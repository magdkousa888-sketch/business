const { JSDOM } = require('jsdom');

const dom = new JSDOM(`<!doctype html><html><body>
  <input id="invoiceNumber" value="INV-TEST-900">
  <table><tbody id="itemsTable"></tbody></table>
</body></html>`);

global.window = dom.window;
global.document = dom.window.document;

require('../js/ui-elements/globals.js');
require('../js/save_invoice.js');

// prepare sample valid items as objects (not DOM nodes)
const item = { 'Item Desc': 'Service A', 'Quantity': '1', 'Item Price': '100', 'Item Tax %': '5', 'Invoice Date': '01/12/2025' };
const ok = window.saveInvoiceData('INV-TEST-900', [item], { invoiceDate: '01/12/2025', customerName: 'TestClient' }, true);
if (!ok) { console.error('FAIL: saveInvoiceData returned false'); process.exitCode = 1; } else {
  if (!Array.isArray(window.allInvoices) || window.allInvoices.length === 0) { console.error('FAIL: allInvoices not updated'); process.exitCode = 2; }
  else console.log('PASS: saveInvoiceData fallback wrote rows to window.allInvoices');
}
