const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'Invoices Control Panel.htm');
const html = fs.readFileSync(file, 'utf8');

const match = html.match(/<th[^>]*width:\s*88px[^>]*>/i) || html.match(/<th[^>]*style="[^"]*width:\s*88px[^"]*"[^>]*>/i);
if (match) {
  console.log('PASS: Found header <th> with width:88px');
  process.exit(0);
} else {
  console.error('FAIL: Did not find header <th> with width:88px');
  process.exit(2);
}
