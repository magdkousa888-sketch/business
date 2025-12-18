// load_credentials.js - Load credentials from user-selected folder using File System Access API
(function() {
  'use strict';

  const STORAGE_KEY = 'invoiceApp_credentialsFolder';

  // Check if File System Access API is supported
  const isFileSystemAccessSupported = 'showDirectoryPicker' in window;

  // Load credentials from folder
  async function loadCredentialsFromFolder(directoryHandle) {
    try {
      // Load API Key
      const apiKeyFile = await directoryHandle.getFileHandle('API Key.txt');
      const apiKeyFileData = await apiKeyFile.getFile();
      const apiKey = (await apiKeyFileData.text()).trim();
      
      // Load Spreadsheet ID
      const sheetIdFile = await directoryHandle.getFileHandle('Google sheet ID.txt');
      const sheetIdFileData = await sheetIdFile.getFile();
      const spreadsheetId = (await sheetIdFileData.text()).trim();

      // Set credentials
      window.GOOGLE_API_KEY = apiKey;
      window.GOOGLE_SPREADSHEET_ID = spreadsheetId;
      
      // Try to load service account
      try {
        const serviceAccountFile = await directoryHandle.getFileHandle('service-account.json');
        const serviceAccountFileData = await serviceAccountFile.getFile();
        const serviceAccount = JSON.parse(await serviceAccountFileData.text());
        window.SERVICE_ACCOUNT_EMAIL = serviceAccount.client_email;
        
        console.log('✅ Credentials loaded successfully');
        console.log('📄 Spreadsheet ID:', spreadsheetId);
        console.log('📧 Service Account:', serviceAccount.client_email);
        
        return { apiKey, spreadsheetId, serviceAccount };
      } catch (e) {
        console.warn('Service account file not found (optional)');
        return { apiKey, spreadsheetId };
      }
    } catch (error) {
      console.error('Failed to load credentials from folder:', error);
      throw error;
    }
  }

  // Prompt user to select credentials folder
  async function selectCredentialsFolder() {
    if (!isFileSystemAccessSupported) {
      alert('Your browser does not support folder selection. Please use Chrome, Edge, or another Chromium-based browser.');
      return null;
    }

    try {
      const directoryHandle = await window.showDirectoryPicker({
        mode: 'read',
        startIn: 'documents'
      });
      
      // Store folder handle for future use
      await storeDirectoryHandle(directoryHandle);
      
      return directoryHandle;
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error selecting folder:', error);
      }
      return null;
    }
  }

  // Store directory handle in IndexedDB
  async function storeDirectoryHandle(directoryHandle) {
    try {
      const db = await openDB();
      const tx = db.transaction('handles', 'readwrite');
      const store = tx.objectStore('handles');
      store.put(directoryHandle, STORAGE_KEY);
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      console.log('✅ Credentials folder saved');
    } catch (error) {
      console.error('Failed to save folder handle:', error);
    }
  }

  // Retrieve directory handle from IndexedDB
  async function getStoredDirectoryHandle() {
    try {
      const db = await openDB();
      const tx = db.transaction('handles', 'readonly');
      const store = tx.objectStore('handles');
      const handle = await new Promise((resolve, reject) => {
        const request = store.get(STORAGE_KEY);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      if (handle) {
        // Verify we still have permission
        const permission = await handle.queryPermission({ mode: 'read' });
        if (permission === 'granted') {
          return handle;
        } else {
          // Request permission again
          const newPermission = await handle.requestPermission({ mode: 'read' });
          if (newPermission === 'granted') {
            return handle;
          }
        }
      }
      return null;
    } catch (error) {
      console.warn('Could not retrieve stored folder:', error);
      return null;
    }
  }

  // Open IndexedDB for storing file handles
  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('InvoiceAppDB', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('handles')) {
          db.createObjectStore('handles');
        }
      };
    });
  }

  // Initialize credentials loading
  async function initializeCredentials() {
    if (!isFileSystemAccessSupported) {
      console.error('❌ File System Access API not supported in this browser');
      console.warn('Please use Chrome, Edge, or another Chromium-based browser');
      return;
    }

    // Try to load from stored folder
    let directoryHandle = await getStoredDirectoryHandle();
    
    if (directoryHandle) {
      try {
        await loadCredentialsFromFolder(directoryHandle);
        return;
      } catch (error) {
        console.warn('Could not load from saved folder, will prompt user to select folder');
      }
    }

    // Prompt user to select folder
    console.log('📂 Please select your credentials folder...');
    // Don't auto-prompt on load, wait for user action
    // The selectCredentialsFolder function will be called from UI
  }

  // Expose functions globally
  window.credentialsManager = {
    selectFolder: selectCredentialsFolder,
    loadFromFolder: loadCredentialsFromFolder,
    isSupported: isFileSystemAccessSupported
  };

  // Initialize on load
  initializeCredentials();

})();
