// google_sheets_client.js - Client-side Google Sheets API wrapper (no server)
(function() {
  'use strict';

  const googleSheetsClient = {
    isInitialized: false,
    spreadsheetId: null,
    apiKey: null,
    clientId: null,
    useOAuth: false,

    /**
     * Initialize the Google API client with credentials from config or localStorage
     */
    async init() {
      if (this.isInitialized) {
        console.log('✅ Google Sheets client already initialized');
        return;
      }

      // Auto-discover credentials from window (google_config.js) or localStorage
      this.apiKey = window.GOOGLE_API_KEY 
        || localStorage.getItem('invoiceApp_google_apiKey')
        || '';
      
      this.clientId = window.GOOGLE_CLIENT_ID 
        || localStorage.getItem('invoiceApp_google_clientId')
        || '';
      
      this.spreadsheetId = window.GOOGLE_SPREADSHEET_ID 
        || localStorage.getItem('invoiceApp_google_spreadsheetId')
        || '';

      if (!this.clientId || !this.spreadsheetId) {
        throw new Error('Missing Google credentials. Client ID and Spreadsheet ID are required for OAuth access.');
      }

      // Always use OAuth for both read and write access to private spreadsheets
      this.useOAuth = true;

      // Load gapi script if not already loaded
      if (typeof gapi === 'undefined') {
        await this._loadGapiScript();
      }

      console.log('🔐 Using OAuth for read/write access...');
      
      // Load the client library and auth2 library
      await new Promise((resolve, reject) => {
        gapi.load('client:auth2', {
          callback: resolve,
          onerror: () => reject(new Error('Failed to load Google API client'))
        });
      });

      // Initialize the client with OAuth
      await gapi.client.init({
        apiKey: this.apiKey,
        clientId: this.clientId,
        discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
        scope: 'https://www.googleapis.com/auth/spreadsheets'
      });

      // Check if user is already signed in
      const auth = gapi.auth2.getAuthInstance();
      if (!auth.isSignedIn.get()) {
        console.log('🔐 Not signed in to Google - attempting sign in...');
        await auth.signIn();
      }

      this.isInitialized = true;
      console.log('✅ Google Sheets client initialized successfully');
      console.log('📄 Access mode: Read/Write (OAuth)');
    },

    /**
     * Dynamically load the gapi script
     */
    _loadGapiScript() {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.onload = resolve;
        script.onerror = () => reject(new Error('Failed to load Google API script'));
        document.head.appendChild(script);
      });
    },

    /**
     * Load a range from the spreadsheet
     * @param {string} range - The A1 notation range (e.g., 'Contacts!A1:BM1000')
     * @param {string} sheetId - Optional override for spreadsheet ID
     * @returns {Promise<object>} Response with values array
     */
    async loadRange(range, sheetId = null) {
      if (!this.isInitialized) {
        await this.init();
      }

      const targetSheetId = sheetId || this.spreadsheetId;
      
      try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
          spreadsheetId: targetSheetId,
          range: range
        });

        return {
          values: response.result.values || [],
          range: response.result.range
        };
      } catch (error) {
        console.error(`Error loading range ${range}:`, error);
        
        // Provide helpful error messages for common issues
        if (error.status === 403 || (error.result && error.result.error && error.result.error.code === 403)) {
          const message = `❌ Permission Denied (403)\n\n` +
            `You need to sign in with a Google account that has access to this spreadsheet.\n\n` +
            `SOLUTIONS:\n` +
            `1. Make sure you're signed in with the correct Google account\n` +
            `2. Share the spreadsheet with your Google account:\n` +
            `   - Open: https://docs.google.com/spreadsheets/d/${targetSheetId}\n` +
            `   - Click "Share" → Add your email → "Editor" or "Viewer"\n` +
            `3. OR make the spreadsheet public:\n` +
            `   - Click "Share" → Change to "Anyone with the link" → "Viewer"\n\n` +
            `Then try loading again.`;
          throw new Error(message);
        }
        
        if (error.status === 404 || (error.result && error.result.error && error.result.error.code === 404)) {
          throw new Error(`Spreadsheet not found. Check that ID is correct: ${targetSheetId}`);
        }
        
        throw new Error(`Failed to load range ${range}: ${error.result?.error?.message || error.message || 'Unknown error'}`);
      }
    },

    /**
     * Append rows to a sheet
     * @param {Array<Array>} rows - Array of row arrays to append
     * @param {string} sheetName - Name of the sheet (e.g., 'Invoices'), defaults to 'Invoices'
     * @param {string} sheetId - Optional override for spreadsheet ID
     * @returns {Promise<object>} Response from append operation
     */
    async appendRows(rows, sheetName = 'Invoices', sheetId = null) {
      if (!this.isInitialized) {
        await this.init();
      }

      const targetSheetId = sheetId || this.spreadsheetId;
      const targetSheetName = sheetName || 'Invoices';
      
      try {
        const response = await gapi.client.sheets.spreadsheets.values.append({
          spreadsheetId: targetSheetId,
          range: `${targetSheetName}!A1`,
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          resource: {
            values: rows
          }
        });

        console.log(`✅ Appended ${rows.length} rows to ${targetSheetName}`);
        return response.result;
      } catch (error) {
        console.error(`Error appending to ${targetSheetName}:`, error);
        
        // Provide helpful error messages for common issues
        if (error.status === 403 || (error.result && error.result.error && error.result.error.code === 403)) {
          const message = `❌ Permission Denied (403)\n\n` +
            `You need write access to append data.\n\n` +
            `SOLUTION: Sign in with OAuth and grant permissions:\n` +
            `1. Set GOOGLE_CLIENT_ID in your google_config.js\n` +
            `2. Sign in when prompted\n` +
            `3. Grant "See, edit, create, and delete your spreadsheets" permission\n\n` +
            `Then try saving again.`;
          throw new Error(message);
        }
        
        throw new Error(`Failed to append rows to ${targetSheetName}: ${error.result?.error?.message || error.message || 'Unknown error'}`);
      }
    },

    /**
     * Append invoice objects to the Invoices sheet
     * Converts objects to arrays using the proper header order
     * @param {Array<object>} invoiceObjects - Array of invoice row objects
     * @param {Array<string>} headerOrder - Optional array defining column order
     * @returns {Promise<object>} Response from append operation
     */
    async appendInvoiceRows(invoiceObjects, headerOrder = null) {
      if (!Array.isArray(invoiceObjects) || invoiceObjects.length === 0) {
        throw new Error('No invoice rows to append');
      }

      // Use provided header order or detect from window globals or first object
      const headers = headerOrder 
        || window.HEADER_ORDER 
        || window.SERVER_HEADER_ORDER 
        || Object.keys(invoiceObjects[0]);
      
      // Convert objects to arrays
      const arrays = this.mapObjectsToArrays(invoiceObjects, headers);
      
      // Remove header row (we only want data rows)
      const dataRows = arrays.slice(1);
      
      if (dataRows.length === 0) {
        throw new Error('No data rows to append after conversion');
      }
      
      // Append to Invoices sheet
      return await this.appendRows(dataRows, 'Invoices');
    },

    /**
     * Update a specific range in the spreadsheet
     * @param {string} range - The A1 notation range to update
     * @param {Array<Array>} values - 2D array of values to write
     * @param {string} sheetId - Optional override for spreadsheet ID
     * @returns {Promise<object>} Response from update operation
     */
    async updateRange(range, values, sheetId = null) {
      if (!this.isInitialized) {
        await this.init();
      }

      const targetSheetId = sheetId || this.spreadsheetId;
      
      try {
        const response = await gapi.client.sheets.spreadsheets.values.update({
          spreadsheetId: targetSheetId,
          range: range,
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: values
          }
        });

        console.log(`✅ Updated range ${range}`);
        return response.result;
      } catch (error) {
        console.error(`Error updating range ${range}:`, error);
        throw new Error(`Failed to update range ${range}: ${error.message || error}`);
      }
    },

    /**
     * Convert array of objects to 2D array for Google Sheets
     * @param {Array<object>} objects - Array of objects to convert
     * @param {Array<string>} headerOrder - Optional array defining column order
     * @returns {Array<Array>} 2D array with header row and data rows
     */
    mapObjectsToArrays(objects, headerOrder = null) {
      if (!Array.isArray(objects) || objects.length === 0) {
        return [];
      }

      // Get headers from first object or use provided order
      const headers = headerOrder || Object.keys(objects[0]);
      
      // Build rows
      const rows = [headers];
      objects.forEach(obj => {
        const row = headers.map(h => {
          const val = obj[h];
          return val !== undefined && val !== null ? String(val) : '';
        });
        rows.push(row);
      });

      return rows;
    },

    /**
     * Parse values array from Google Sheets to array of objects
     * @param {Array<Array>} values - 2D array from Google Sheets (first row = headers)
     * @returns {Array<object>} Array of objects
     */
    parseValuesToObjects(values) {
      if (!Array.isArray(values) || values.length === 0) return [];
      
      const headers = values[0] || [];
      const rows = values.slice(1) || [];
      
      return rows.map(r => {
        const obj = {};
        headers.forEach((h, i) => { 
          obj[h] = r[i] !== undefined ? r[i] : ''; 
        });
        return obj;
      }).filter(row => Object.values(row).some(v => String(v).trim() !== ''));
    },

    /**
     * Check if user is signed in
     * @returns {boolean} True if signed in
     */
    isSignedIn() {
      if (!this.isInitialized || typeof gapi === 'undefined' || !gapi.auth2) {
        return false;
      }
      const auth = gapi.auth2.getAuthInstance();
      return auth && auth.isSignedIn.get();
    },

    /**
     * Sign out the current user
     */
    async signOut() {
      if (this.isInitialized && typeof gapi !== 'undefined' && gapi.auth2) {
        const auth = gapi.auth2.getAuthInstance();
        if (auth) {
          await auth.signOut();
          console.log('✅ Signed out from Google');
        }
      }
    }
  };

  // Expose to window
  window.googleSheetsClient = googleSheetsClient;
  
  console.log('✅ google_sheets_client.js loaded');
})();
