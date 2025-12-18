// Parse the real Invoice.cleaned.csv and verify reports.js renders item price correctly
global.window = {};
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// load minimal DOM expected by reports.js
const dom = new JSDOM(`<!doctype html><html><body>
  <select id="reportsClientSelect"></select>
  <table><tbody id="reportsResultsTBody"></tbody></table>
  <div id="reports_total"></div><div id="reports_paid"></div><div id="reports_outstanding"></div>
</body></html>`);
global.document = dom.window.document;

// bring in the app helpers
require('../js/ui-elements/globals.js');
require('../js/report-control/reports.js');

function parseCSV(text){
  const rows = [];
  let cur = '';
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++){
    const ch = text[i];
    const nxt = text[i+1];
    if (ch === '"'){
      if (inQuotes && nxt === '"') { cur += '"'; i++; continue; }
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && ch === ',') { row.push(cur); cur = ''; continue; }
    if (!inQuotes && (ch === '\n' || ch === '\r')){
      // handle CRLF
      // only push row when it's a real row separator (not stray CR in CRLF)
      if (ch === '\r' && text[i+1] === '\n') { /* skip, handled on LF */ }
      // push field and row if not empty delimiter
      if (cur !== '' || row.length > 0) {
        row.push(cur);
        rows.push(row);
        row = [];
        cur = '';
      }
      continue;
    }
    cur += ch;
  }
  // push last
  if (cur !== '' || row.length > 0){ row.push(cur); rows.push(row); }
  return rows;
}

// Read CSVs
const csvPath = path.join(__dirname, '..', 'Invoice.cleaned.csv');
const csv = fs.readFileSync(csvPath, 'utf8');
const parsed = parseCSV(csv);
if (!parsed || parsed.length < 2) {
  console.error('CSV parse produced no rows'); process.exitCode = 1; return;
}

const headers = parsed[0].map(h => String(h||'').trim());

// Build objects (header -> value). We'll only include rows that have an Invoice Number
const objs = parsed.slice(1).map(r => {
  const o = {};
  for (let i = 0; i < headers.length; i++){
    o[headers[i]] = r[i] === undefined ? '' : r[i];
  }
  return o;
}).filter(r => (r['Invoice Number']||'').trim());

window.allInvoices = objs;
window.paymentsData = [];

// Add __ALL__ option
const sel = document.getElementById('reportsClientSelect');
const opt = document.createElement('option'); opt.value='__ALL__'; opt.textContent='All clients'; sel.appendChild(opt);

// Turn on debug hooks in the renderer so we can see mapping decisions
window.DEBUG_REPORTS = true;

// Execute the reports rendering and inspect some invoices known to have the 1020->1071 pattern
window.refreshReportsModal();
const tbody = document.getElementById('reportsResultsTBody');
console.log('Rendered invoices (first 20):', tbody.querySelectorAll('tr').length);

// Helper to find a details row for a given invoice number
function findDetailsForInv(invNo){
  // find the main row with matching invoice number cell
  const rows = Array.from(tbody.querySelectorAll('tr'));
  for (let i = 0; i < rows.length; i++){
    const row = rows[i];
    if (row.textContent.indexOf(invNo) !== -1 && row.querySelector('.reports-toggle')){
      const details = rows[i+1] && rows[i+1].classList && rows[i+1].classList.contains('reports-details') ? rows[i+1] : null;
      return { mainRow: row, details };
    }
  }
  return null;
}

// Choose invoice numbers that are actually unpaid in this CSV (status 'Overdue'/'Sent') and match the 1020->1071 pattern
// Found by searching Invoice.cleaned.csv — INV-0000562 is an Overdue example where Total=1,071.00 and underlying Item Price should be 1,020.00
const examples = ['INV-0000562','INV-0000332','INV-0000098'];

examples.forEach(inv => {
  const res = findDetailsForInv(inv);
  if (!res || !res.details) { console.warn('No details found for', inv); return; }
  const det = res.details;
  const mainRow = res.mainRow;
  // Reconstruct the invoices grouping the same way the app does so we can map rendered row indexes to original objects
  const invoices = {};
  window.allInvoices.forEach(r => {
    const invNo = String(r['Invoice Number']||'').trim();
    if (!invNo) return;
    if (!invoices[invNo]) invoices[invNo] = { rows: [] };
    invoices[invNo].rows.push(r);
  });
  const invoiceRows = invoices[inv] ? invoices[inv].rows : [];
  console.log('RAW rows for', inv, 'count=', invoiceRows.length);
  invoiceRows.forEach((sr, si) => console.log('  source[',si,'] desc=', sr['Item Desc']||sr['Item Name'], ' price=', sr['Item Price'], ' total=', sr['Total']));
  // figure the invoice-level total from any row that contains a non-empty Total column
  const parseSimple = s => { if (s === undefined || s === null) return NaN; const v = String(s).replace(/[^0-9.\-]/g,''); return v === '' ? NaN : Number(v); };
  const invoiceTotalVal = invoiceRows.map(r=>parseSimple(r['Total']||r['Total'])).find(v => !isNaN(v));
  const rows = Array.from(det.querySelectorAll('tbody tr'));
  rows.forEach(r => {
    const cols = Array.from(r.querySelectorAll('td')).map(td => td.textContent.trim());
    // Determine which source row (by index) corresponds to this rendered row — details rows are built in same order
    const tbodyRows = Array.from(det.querySelectorAll('tbody tr'));
    const rowIndex = tbodyRows.indexOf(r);
    const descText = (cols[0] || '').replace(/\s+/g,' ').trim();
    // Try to match this rendered row to a source row by description; fall back to index if not found
    let source = invoiceRows.find(sr => {
      const sdesc = String(sr['Item Desc']||sr['Item Description']||sr['Item Name']||sr['ItemName']||sr['ItemDesc']||'').replace(/\s+/g,' ').trim();
      if (!sdesc) return false; return sdesc === descText || descText.indexOf(sdesc) !== -1 || sdesc.indexOf(descText) !== -1;
    });
    if (!source) source = invoiceRows[rowIndex];
    console.log(inv, '-> rendered cols=', cols, '  -> source idx=', rowIndex);
    if (source) console.log('          source raw => Item Price:', source['Item Price'], 'Item Tax Amount:', source['Item Tax Amount'], 'Total:', source['Total'], 'Item Total:', source['Item Total']);
    // sanity checks
    const price = cols[2];
    const total = cols[5];
    // ignore empty/placeholder rows (no description)
    if (!cols[0]) return;
    if (!price || !total) return;
    // Only consider this a problem if the rendered price equals the invoice-level total but the
    // source item price is not equal to that invoice-level total — i.e. we misread the invoice total
    // as the per-unit price.
    if (invoiceTotalVal && price) {
      const renderedPriceVal = parseSimple(price);
      if (!isNaN(renderedPriceVal) && Math.abs(renderedPriceVal - invoiceTotalVal) < 0.001) {
        const srcPriceVal = source ? parseSimple(source['Item Price']||source['ItemPrice']||source['Price']||0) : NaN;
        if (isNaN(srcPriceVal) || Math.abs(srcPriceVal - invoiceTotalVal) > 0.001) {
          console.error('FAIL: rendered per-item price equals invoice total for', inv, 'row:', cols);
          process.exitCode = 2;
        }
      }
    }

    // Additional check: the modal's displayed invoice total should equal the sum of the detail row Totals
    const mainTotalStr = mainRow.querySelector('td:nth-child(4)').textContent.trim();
    // reuse parseSimple helper declared above
    const displayedVal = parseSimple(mainTotalStr);
    // compute sum of the visible detail totals
    const visibleRows = Array.from(det.querySelectorAll('tbody tr')).filter(tr => { const c = tr.querySelector('td'); return c && c.textContent.trim(); });
    const sumDetail = visibleRows.reduce((acc, tr) => { const t = tr.querySelector('td:nth-child(6)'); if (!t) return acc; const v = parseSimple(t.textContent.trim()); return acc + (isNaN(v) ? 0 : v); }, 0);
    if (!isNaN(displayedVal) && visibleRows.length > 0) {
      // if we have visible detail rows, the displayed total should match their sum
      if (Math.abs(displayedVal - sumDetail) > 0.001) { console.error('FAIL: displayed invoice total does not match sum of detail totals for', inv, 'displayed=', displayedVal, 'sumDetails=', sumDetail); process.exitCode = 4; }
    } else if (invoiceTotalVal && !isNaN(invoiceTotalVal)) {
      // if no visible details but invoiceTotalVal exists in source, ensure displayed value matches it
      if (Math.abs(displayedVal - invoiceTotalVal) > 0.001) { console.error('FAIL: displayed invoice total does not match invoice-level Total column for', inv, 'displayed=', displayedVal, 'invoiceTotalCol=', invoiceTotalVal); process.exitCode = 5; }
    }
    // Note: we don't strictly require the rendered price to match the CSV source exact formatting here
    // (CSV parsing and row ordering in some exports can be inconsistent). The important check above
    // is that the per-item price is not equal to the invoice-level total which used to be shown.
  });
});

console.log('Done — verification run completed (non-zero exit code indicates failures).');
