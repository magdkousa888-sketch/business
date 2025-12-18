// google_config.js - Google Sheets credentials (loaded from user-selected folder)
(function() {
  'use strict';

  window.GOOGLE_CONFIG = {
    apiKey: window.GOOGLE_API_KEY || null,
    spreadsheetId: window.GOOGLE_SPREADSHEET_ID || null,
    clientId: '',
    serviceAccountEmail: window.SERVICE_ACCOUNT_EMAIL || null,
    
    ranges: {
      contacts: 'Contacts!A1:BL1000',
      payments: 'Customer Payments!A1:Z1000',
      invoices: 'Invoices!A1:DM2000'
    }
  };

  window.GOOGLE_API_KEY = window.GOOGLE_CONFIG.apiKey;
  window.GOOGLE_SPREADSHEET_ID = window.GOOGLE_CONFIG.spreadsheetId;
  window.GOOGLE_CLIENT_ID = window.GOOGLE_CONFIG.clientId;
  
  window.CONTACTS_RANGE = window.GOOGLE_CONFIG.ranges.contacts;
  window.PAYMENTS_RANGE = window.GOOGLE_CONFIG.ranges.payments;
  window.INVOICES_RANGE = window.GOOGLE_CONFIG.ranges.invoices;

  console.log('✅ Google config initialized');
  if (window.GOOGLE_CONFIG.spreadsheetId) {
    console.log('📄 Spreadsheet ID:', window.GOOGLE_CONFIG.spreadsheetId);
  }

})();
