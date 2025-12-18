const {google} = require('googleapis');
const fs = require('fs');

async function run(){
  const SA_PATH = './Keys/service-account.json';
  const SPREADSHEET_ID = '1PLxaoFIZC4LEqFf7kJI1tQNOrGfFsEOjn6kt3QB30HU';
  if (!fs.existsSync(SA_PATH)) throw new Error('service-account.json not found at ' + SA_PATH);
  const sa = JSON.parse(fs.readFileSync(SA_PATH,'utf8'));
  const jwt = new google.auth.JWT(sa.client_email, null, sa.private_key, ['https://www.googleapis.com/auth/spreadsheets']);
  await jwt.authorize();
  const sheets = google.sheets({ version: 'v4', auth: jwt });

  const row = [
    "1","02/12/2025","","","sdfs","Accrued Phone / Mobile Expenses","","IBS Consultancy - ENBD","","ABC Mostard","Liquidation of Smart","gcc_non_vat","Sharjah","","","","","False","","","","","","","","","","","","0","","Service","","","","30","30",""
  ];

  try {
    console.log('Attempting append to', SPREADSHEET_ID, 'sheet Expenses');
    const r = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Expenses!A1',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] }
    });

    console.log('Append succeeded:', JSON.stringify(r.data, null, 2));
  } catch (e) {
    console.error('Append failed:', e && (e.response && e.response.data) ? e.response.data : e.message || e);
    process.exit(1);
  }
}

run();