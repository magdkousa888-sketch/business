// Print relevant fields for an invoice number from Invoice.cleaned.csv
const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, '..', 'Invoice.cleaned.csv');
if (!fs.existsSync(csvPath)) { console.error('CSV not found:', csvPath); process.exit(1); }
const txt = fs.readFileSync(csvPath,'utf8');

function splitCSVLine(line){
  const fields = [];
  let cur = '';
  let inQ = false;
  for (let i=0;i<line.length;i++){
    const ch = line[i];
    const nxt = line[i+1];
    if (ch === '"'){
      if (inQ && nxt === '"') { cur += '"'; i++; continue; }
      inQ = !inQ; continue;
    }
    if (!inQ && ch === ',') { fields.push(cur); cur=''; continue; }
    cur += ch;
  }
  fields.push(cur);
  return fields;
}

const lines = txt.split(/\r?\n/);
const headerLine = lines.find(l => l.trim().length>0);
const headers = splitCSVLine(headerLine).map(h=>h.trim());

const invoiceNum = process.argv[2] || 'INV-0000562';

console.log('Looking up', invoiceNum, ' — showing fields: Quantity, Item Price, Discount Amount, Item Tax Amount, Item Total, SubTotal, Total');

lines.forEach((ln, idx)=>{
  if (!ln || ln.indexOf(invoiceNum) === -1) return;
  const vals = splitCSVLine(ln);
  // build map
  const obj = {};
  for (let i=0;i<headers.length;i++) obj[headers[i]] = (vals[i]||'').trim();
  // print key fields
  console.log('\n--- row index', idx, '---');
  console.log('Invoice Number:', obj['Invoice Number']||obj['Invoice No']||obj['Invoice#']);
  console.log('Description:', obj['Item Desc']||obj['Item Name']||obj['Item Description']);
  console.log('Quantity:', obj['Quantity']||obj['Qty']||'');
  console.log('Item Price:', obj['Item Price']||obj['ItemPrice']||obj['Price']||'');
  console.log('Discount Amount:', obj['Discount Amount']||obj['Discount']||'');
  console.log('Item Tax Amount:', obj['Item Tax Amount']||obj['ItemTaxAmount']||obj['Item Tax']||obj['Tax Amount']||'');
  console.log('Item Total / Item Total:', obj['Item Total']||obj['ItemTotal']||obj['Item_Total']||'');
  console.log('SubTotal:', obj['SubTotal']||'');
  console.log('Total:', obj['Total']||obj['Invoice Total']||'');
});
