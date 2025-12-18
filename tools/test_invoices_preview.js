const fs = require('fs');
const path = require('path');

function parseCsv(text){
  return text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean).map(l=>l.split(',').map(c=>c.trim()));
}

function buildIndexMap(values, dataset){
  const out = {};
  values.forEach(row => {
    if (row.length < 2) return;
    const datasetName = row[0];
    const colName = row[1];
    const idx = row[2] !== undefined && row[2] !== '' ? parseInt(row[2], 10) : null;
    if (String(datasetName).toLowerCase() === String(dataset).toLowerCase()) out[colName] = (isNaN(idx) ? null : idx);
  });
  return out;
}

function getInvoiceAppendRow(invoiceObj, indexMap){
  const numericKeys = indexMap ? Object.keys(indexMap).filter(k => Number.isFinite(indexMap[k])) : [];
  if (indexMap && numericKeys.length>0){
    const maxIndex = Math.max(...numericKeys.map(k => indexMap[k]));
    const arr = new Array(maxIndex+1).fill('');
    const objNorm = {};
    Object.keys(invoiceObj||{}).forEach(k => objNorm[String(k).trim().toLowerCase()] = invoiceObj[k]);
    Object.keys(indexMap).forEach(k => {
      const idx = indexMap[k];
      if (!Number.isFinite(idx)) return;
      const normKey = String(k).trim().toLowerCase();
      const val = objNorm.hasOwnProperty(normKey) ? objNorm[normKey] : '';
      arr[idx] = (val === undefined || val === null) ? '' : String(val);
    });
    return arr;
  }
  return null;
}

(async function(){
  const columnsPath = path.join(__dirname, '..', 'Columns index.csv');
  const data = fs.readFileSync(columnsPath, 'utf8');
  const parsed = parseCsv(data);
  const indexMap = buildIndexMap(parsed, 'Invoices');
  console.log('Invoice mapping sample keys:', Object.keys(indexMap).slice(0, 8));
  console.log('Tax Registration Number index =>', indexMap['Tax Registration Number']);

  const sample = {
    'Invoice Number': 'INV-0001000',
    'Invoice Date': '01/12/2025',
    'Customer Name': 'Example Co',
    'Billing Address': 'Dubai',
    'Tax Registration Number': 'TRN-987654',
    'Client TRN': 'TRN-987654'
  };
  const row = getInvoiceAppendRow(sample, indexMap);
  console.log('Row length:', row ? row.length : 'no row');
  if (row){
    const idx = indexMap['Tax Registration Number'];
    console.log('Value at TRN index:', row[idx]);
  }
})();
