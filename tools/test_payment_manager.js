const { JSDOM } = require('jsdom');

const dom = new JSDOM(`<!doctype html><html><body>
  <input id="invoiceNumber" value="INV-TEST-900">
  <span id="grandTotal">AED 150.00</span>
  <span id="balanceDue"></span>
  <span id="remainingBalance"></span>
  <div class="totals"></div>
</body></html>`, { url: 'http://localhost/' });

global.window = dom.window;
global.document = dom.window.document;

// Provide a simple in-memory localStorage shim for tests so save/load work in JSDOM
global.window.localStorage = (function(){
  const state = {};
  return {
    getItem(k){ return Object.prototype.hasOwnProperty.call(state, k) ? state[k] : null; },
    setItem(k,v){ state[k] = String(v); },
    removeItem(k){ delete state[k]; },
    clear(){ for (const k of Object.keys(state)) delete state[k]; }
  };
})();

require('../js/ui-elements/globals.js');
require('../js/payment-conrol/payment_manager.js');

// ensure API present
if (!window.paymentManager) { console.error('FAIL: paymentManager not present'); process.exitCode = 1; }

// start with an empty payments array
window.paymentsData = [];

// add sample payments
window.paymentsData.push({"Invoice Number":"INV-TEST-900","Amount Applied to Invoice":"100.00","Invoice Payment Applied Date":"2025-12-01"});
window.paymentsData.push({"Invoice Number":"INV-TEST-900","Amount Applied to Invoice":"50.00","Invoice Payment Applied Date":"2025-12-02"});

const rows = window.paymentManager.getPaymentsForInvoice('INV-TEST-900');
if (!Array.isArray(rows) || rows.length !== 2) { console.error('FAIL: getPaymentsForInvoice failed', rows); process.exitCode = 2; }

const totalPaid = window.paymentManager.getTotalPaidForInvoice('INV-TEST-900');
if (totalPaid !== 150) { console.error('FAIL: getTotalPaidForInvoice expected 150 got', totalPaid); process.exitCode = 3; }

// generate CSV string
const csv = window.paymentManager.generatePaymentsCSVString();
if (typeof csv !== 'string' || csv.split('\n').length !== (window.paymentsData.length + 1)) { console.error('FAIL: CSV string incorrect', csv); process.exitCode = 4; }

// persistence functions should exist (localStorage may not be available in test env)
if (typeof window.savePaymentsToLocalStorage !== 'function') { console.error('FAIL: savePaymentsToLocalStorage missing'); process.exitCode = 5; }
if (typeof window.paymentManager.loadPaymentsFromLocalStorage !== 'function') { console.error('FAIL: loadPaymentsFromLocalStorage missing'); process.exitCode = 6; }

console.log('PASS: payment manager basic functions');
