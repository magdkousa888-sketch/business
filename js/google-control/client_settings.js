// client_settings.js - Google Sheets credentials management UI
(function() {
  'use strict';

  // Create and inject the settings modal
  function createSettingsModal() {
    const modalHTML = `
      <div id="googleSettingsModal" class="modal-overlay" style="display: none;">
        <div class="modal-content" style="max-width: 600px;">
          <div class="modal-header">
            <h3>⚙️ Google Sheets Settings</h3>
            <button onclick="closeGoogleSettings()" class="modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <div style="margin-bottom: 20px; padding: 10px; background: #e3f2fd; border-left: 4px solid #2196F3; font-size: 12px;">
              <strong>📖 Setup Instructions:</strong>
              <ol style="margin: 10px 0 0 0; padding-left: 20px;">
                <li>Go to <a href="https://console.cloud.google.com/" target="_blank">Google Cloud Console</a></li>
                <li>Create a new project or select existing one</li>
                <li>Enable Google Sheets API</li>
                <li>Create credentials (API Key + OAuth 2.0 Client ID)</li>
                <li>Add authorized JavaScript origins (e.g., http://localhost)</li>
                <li>Copy your Spreadsheet ID from the URL</li>
              </ol>
            </div>

            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; font-weight: bold;">Google API Key <span style="color:red">*</span></label>
              <input type="text" id="googleApiKeyInput" 
                placeholder="AIza..." 
                style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" />
              <small style="color: grey;">Used for read-only access to public sheets</small>
            </div>

            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; font-weight: bold;">OAuth Client ID <span style="color:red">*</span></label>
              <input type="text" id="googleClientIdInput" 
                placeholder="123456789-abc...apps.googleusercontent.com" 
                style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" />
              <small style="color: grey;">Used for authenticated read/write access</small>
            </div>

            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; font-weight: bold;">Spreadsheet ID <span style="color:red">*</span></label>
              <input type="text" id="googleSpreadsheetIdInput" 
                placeholder="1ABC...XYZ" 
                style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" />
              <small style="color: grey;">Found in your Google Sheets URL between /d/ and /edit</small>
            </div>

            <div style="display: flex; gap: 10px; margin-top: 20px;">
              <button onclick="saveGoogleSettings()" class="save-client-btn btn flex-1">
                💾 Save Settings
              </button>
              <button onclick="testGoogleConnection()" class="save-client-btn btn btn-success flex-1">
                🔧 Test Connection
              </button>
              <button onclick="clearGoogleSettings()" class="save-client-btn btn btn-danger">
                🗑️ Clear
              </button>
            </div>

            <div id="googleSettingsStatus" style="margin-top: 15px; padding: 10px; border-radius: 4px; font-size: 12px; display: none;"></div>
          </div>
        </div>
      </div>
    `;

    // Inject modal into body
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = modalHTML;
    document.body.appendChild(tempDiv.firstElementChild);
  }

  // Open settings modal and load saved credentials
  window.openGoogleSettings = function() {
    const modal = document.getElementById('googleSettingsModal');
    if (!modal) {
      createSettingsModal();
    }

    // Load saved credentials
    const apiKey = localStorage.getItem('invoiceApp_google_apiKey') || window.GOOGLE_API_KEY || '';
    const clientId = localStorage.getItem('invoiceApp_google_clientId') || window.GOOGLE_CLIENT_ID || '';
    const spreadsheetId = localStorage.getItem('invoiceApp_google_spreadsheetId') || window.GOOGLE_SPREADSHEET_ID || '';

    document.getElementById('googleApiKeyInput').value = apiKey;
    document.getElementById('googleClientIdInput').value = clientId;
    document.getElementById('googleSpreadsheetIdInput').value = spreadsheetId;

    document.getElementById('googleSettingsModal').style.display = 'flex';
    document.getElementById('googleSettingsStatus').style.display = 'none';
  };

  // Close settings modal
  window.closeGoogleSettings = function() {
    document.getElementById('googleSettingsModal').style.display = 'none';
  };

  // Save credentials to localStorage
  window.saveGoogleSettings = function() {
    const apiKey = document.getElementById('googleApiKeyInput').value.trim();
    const clientId = document.getElementById('googleClientIdInput').value.trim();
    const spreadsheetId = document.getElementById('googleSpreadsheetIdInput').value.trim();

    if (!apiKey || !clientId || !spreadsheetId) {
      showSettingsStatus('❌ All fields are required!', 'error');
      return;
    }

    try {
      localStorage.setItem('invoiceApp_google_apiKey', apiKey);
      localStorage.setItem('invoiceApp_google_clientId', clientId);
      localStorage.setItem('invoiceApp_google_spreadsheetId', spreadsheetId);

      // Also set on window for immediate use
      window.GOOGLE_API_KEY = apiKey;
      window.GOOGLE_CLIENT_ID = clientId;
      window.GOOGLE_SPREADSHEET_ID = spreadsheetId;

      showSettingsStatus('✅ Settings saved successfully! You can now load data from Google Sheets.', 'success');
      
      console.log('✅ Google credentials saved to localStorage');
    } catch (error) {
      console.error('Error saving credentials:', error);
      showSettingsStatus('❌ Error saving settings: ' + error.message, 'error');
    }
  };

  // Test Google connection
  window.testGoogleConnection = async function() {
    const apiKey = document.getElementById('googleApiKeyInput').value.trim();
    const clientId = document.getElementById('googleClientIdInput').value.trim();
    const spreadsheetId = document.getElementById('googleSpreadsheetIdInput').value.trim();

    if (!apiKey || !clientId || !spreadsheetId) {
      showSettingsStatus('❌ Please fill in all fields before testing', 'error');
      return;
    }

    showSettingsStatus('⏳ Testing connection to Google Sheets...', 'info');

    try {
      // Temporarily set credentials for test
      window.GOOGLE_API_KEY = apiKey;
      window.GOOGLE_CLIENT_ID = clientId;
      window.GOOGLE_SPREADSHEET_ID = spreadsheetId;

      // Reset initialization state
      if (window.googleSheetsClient) {
        window.googleSheetsClient.isInitialized = false;
      }

      // Try to initialize
      await window.googleSheetsClient.init();

      showSettingsStatus('✅ Connection successful! Credentials are valid.', 'success');
    } catch (error) {
      console.error('Connection test failed:', error);
      showSettingsStatus('❌ Connection failed: ' + error.message, 'error');
    }
  };

  // Clear all saved credentials
  window.clearGoogleSettings = function() {
    if (!confirm('Are you sure you want to clear all Google Sheets credentials?')) {
      return;
    }

    localStorage.removeItem('invoiceApp_google_apiKey');
    localStorage.removeItem('invoiceApp_google_clientId');
    localStorage.removeItem('invoiceApp_google_spreadsheetId');

    delete window.GOOGLE_API_KEY;
    delete window.GOOGLE_CLIENT_ID;
    delete window.GOOGLE_SPREADSHEET_ID;

    document.getElementById('googleApiKeyInput').value = '';
    document.getElementById('googleClientIdInput').value = '';
    document.getElementById('googleSpreadsheetIdInput').value = '';

    showSettingsStatus('🗑️ All credentials cleared', 'info');
  };

  // Show status message
  function showSettingsStatus(message, type) {
    const statusEl = document.getElementById('googleSettingsStatus');
    statusEl.style.display = 'block';
    statusEl.textContent = message;
    
    // Color based on type
    if (type === 'success') {
      statusEl.style.background = '#d4edda';
      statusEl.style.color = '#155724';
      statusEl.style.border = '1px solid #c3e6cb';
    } else if (type === 'error') {
      statusEl.style.background = '#f8d7da';
      statusEl.style.color = '#721c24';
      statusEl.style.border = '1px solid #f5c6cb';
    } else {
      statusEl.style.background = '#d1ecf1';
      statusEl.style.color = '#0c5460';
      statusEl.style.border = '1px solid #bee5eb';
    }
  }

  // Auto-load credentials on page load
  window.addEventListener('DOMContentLoaded', function() {
    const apiKey = localStorage.getItem('invoiceApp_google_apiKey');
    const clientId = localStorage.getItem('invoiceApp_google_clientId');
    const spreadsheetId = localStorage.getItem('invoiceApp_google_spreadsheetId');

    if (apiKey && clientId && spreadsheetId) {
      window.GOOGLE_API_KEY = apiKey;
      window.GOOGLE_CLIENT_ID = clientId;
      window.GOOGLE_SPREADSHEET_ID = spreadsheetId;
      console.log('✅ Google credentials loaded from localStorage');
    }
  });

  console.log('✅ client_settings.js loaded');
})();
