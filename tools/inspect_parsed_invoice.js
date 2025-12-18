// Use same robust parse as the test harness, then print parsed objects for an invoice
const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, '..', 'Invoice.cleaned.csv');
if (!fs.existsSync(csvPath)) { console.error('CSV not found:', csvPath); process.exit(1); }
const txt = fs.readFileSync(csvPath,'utf8');

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
      if (ch === '\r' && text[i+1] === '\n') { /* will skip on LF */ }
      if (cur !== '' || row.length > 0) { row.push(cur); rows.push(row); row = []; cur = ''; }
      continue;
    }
    cur += ch;
  }
  if (cur !== '' || row.length > 0){ row.push(cur); rows.push(row); }
  return rows;
}

const rows = parseCSV(txt);
const header = rows[0].map(h=> String(h||'').trim());
const invoiceToFind = process.argv[2] || 'INV-0000562';

const matches = rows.slice(1).map(r=>{
  const obj = {};
  for (let i=0;i<header.length;i++) obj[header[i]] = r[i] === undefined ? '' : r[i];
  return obj;
}).filter(o=> String(o['Invoice Number']||'').trim() === invoiceToFind);

if (!matches.length){ console.log('No parsed rows found for', invoiceToFind); process.exit(0); }

console.log('Found', matches.length, 'parsed rows for', invoiceToFind);
matches.forEach((m, idx)=>{
  console.log('\nROW', idx);
  console.log('Description:', m['Item Desc']||m['Item Name']||'');
  console.log('Quantity:', m['Quantity']||m['Qty']||'');
  console.log('Item Price:', m['Item Price']||m['ItemPrice']||m['Price']||'');
  console.log('Discount Amount:', m['Discount Amount']||m['Discount']||'');
  console.log('Item Tax Amount:', m['Item Tax Amount']||m['ItemTaxAmount']||m['Item Tax']||m['Tax Amount']||'');
  console.log('Item Total:', m['Item Total']||m['ItemTotal']||m['Amount']||m['Total']||'');
});
