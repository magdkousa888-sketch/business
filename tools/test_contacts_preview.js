const fs = require('fs');
const path = require('path');

function parseCsv(text){
  return text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean).map(l=>l.split(',').map(c=>c.trim()));
}

function buildContactsIndexMap(values){
  const out = {};
  values.forEach(row => {
    if (row.length < 2) return;
    const dataset = row[0];
    const colName = row[1];
    const idx = row[2] !== undefined && row[2] !== '' ? parseInt(row[2], 10) : null;
    if (String(dataset).toLowerCase() === 'contacts') out[colName] = (isNaN(idx) ? null : idx);
  });
  return out;
}

function getContactsAppendRow(contactsObj, indexMap){
  const numericKeys = indexMap ? Object.keys(indexMap).filter(k => Number.isFinite(indexMap[k])) : [];
  if (indexMap && numericKeys.length>0){
    const maxIndex = Math.max(...numericKeys.map(k => indexMap[k]));
    const arr = new Array(maxIndex+1).fill('');
    const objNorm = {};
    Object.keys(contactsObj||{}).forEach(k => objNorm[String(k).trim().toLowerCase()] = contactsObj[k]);
    if ((!objNorm['tax registration number'] || objNorm['tax registration number']==='') && objNorm['trn number']) objNorm['tax registration number'] = objNorm['trn number'];
    if ((!objNorm['tax registration number'] || objNorm['tax registration number']==='') && objNorm['trn']) objNorm['tax registration number'] = objNorm['trn'];
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
  const indexMap = buildContactsIndexMap(parsed);
  console.log('Found mapping keys (sample):', Object.keys(indexMap).slice(0,10));
  console.log('Tax Registration Number index =>', indexMap['Tax Registration Number']);

  const sampleClient = {
    'Display Name': 'Example Co',
    'Company Name': 'Example Co LLC',
    'Contact Name': 'Jane Doe',
    'EmailID': 'jane@example.com',
    'MobilePhone': '+971500000000',
    'Tax Registration Number': 'TRN-123456',
    'Billing Address': 'Dubai',
    'City': 'Dubai',
    'Country': 'United Arab Emirates'
  };

  const row = getContactsAppendRow(sampleClient, indexMap);
  console.log('Row length:', row ? row.length : 'no row');
  if (row){
    const idx = indexMap['Tax Registration Number'];
    console.log('Value at TRN index:', row[idx]);
    console.log('First 60 columns preview:', row.slice(0, 60));
  }
})();
