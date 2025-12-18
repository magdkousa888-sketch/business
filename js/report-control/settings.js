// settings.js — small UI for app settings (persisted to localStorage)
(function(){
  'use strict';

  const KEY_SHOW_INACTIVE = 'app_settings_showInactiveClients';
  const KEY_AUTO_LOAD = 'invoiceApp_autoLoadData';

  function el(id){ return document.getElementById(id); }

  function loadShowInactive(){
    try { return localStorage.getItem(KEY_SHOW_INACTIVE) === '1'; } catch(e){ return false; }
  }

  function saveShowInactive(val){
    try { localStorage.setItem(KEY_SHOW_INACTIVE, val ? '1' : '0'); return true; } catch(e){ console.warn('settings: failed to save', e); return false; }
  }

  function loadAutoLoad(){
    try {
      const v = localStorage.getItem(KEY_AUTO_LOAD);
      if (v === null) return null; // no stored preference
      return v === '1';
    } catch(e){ return true; }
  }

  function saveAutoLoad(val){
    try { localStorage.setItem(KEY_AUTO_LOAD, val ? '1' : '0'); return true; } catch(e){ console.warn('settings: failed to save autoLoad', e); return false; }
  }

  function openSettings(){
    const m = el('settingsModal'); if (!m) return; m.style.display = 'flex'; document.body.style.overflow='hidden';
    try { const cb = el('showInactiveClients'); if (cb) cb.checked = loadShowInactive(); } catch(e){}
    updateCredentialsFolderStatus();
    // Initialize auto-load radio controls from stored value
    try {
      const rOff = document.getElementById('autoLoadOff');
      const rOn = document.getElementById('autoLoadOn');
      if (rOff && rOn) {
        const auto = loadAutoLoad();
        if (auto === null) {
          rOff.checked = false; rOn.checked = false;
        } else {
          rOff.checked = !auto;
          rOn.checked = !!auto;
        }
        // Persist immediately when user changes radio choice
        rOff.onchange = function(){ if (rOff.checked) { saveAutoLoad(false); console.log('settings: autoLoad saved -> false (via change)'); } };
        rOn.onchange = function(){ if (rOn.checked) { saveAutoLoad(true); console.log('settings: autoLoad saved -> true (via change)'); } };
      }
    } catch(e) { /* noop */ }
  }

  function closeSettings(){ const m = el('settingsModal'); if (!m) return; m.style.display = 'none'; document.body.style.overflow='auto'; }

  function applySettings(){
    try {
      const cb = el('showInactiveClients'); if (!cb) return;
      const newVal = !!cb.checked;
      saveShowInactive(newVal);
      // Persist auto-load selection if present
      try {
        const sel = document.querySelector('input[name="autoLoadChoice"]:checked');
        if (sel) {
          const on = String(sel.value) === '1';
          saveAutoLoad(on);
          console.log('settings: autoLoad saved ->', on);
        }
      } catch(e) { console.warn('applySettings: autoLoad handling failed', e); }
      // refresh client lists everywhere
      try { if (window.clientManager && typeof window.clientManager.refreshAllClientReferences === 'function') window.clientManager.refreshAllClientReferences(); } catch(e){}
      try { if (window.populateReportsClientSelect) window.populateReportsClientSelect(); } catch(e){}
      try { if (typeof window.initializeFilterClientDropdown === 'function') window.initializeFilterClientDropdown(); } catch(e){}
      closeSettings();
    } catch(e){ console.warn('settings.apply failed', e); }
  }

  // Credentials folder selection
  async function selectCredentialsFolder() {
    if (!window.credentialsManager || !window.credentialsManager.isSupported) {
      alert('Your browser does not support folder selection. Please use Chrome, Edge, or another Chromium-based browser.');
      return;
    }

    try {
      const directoryHandle = await window.credentialsManager.selectFolder();
      if (directoryHandle) {
        await window.credentialsManager.loadFromFolder(directoryHandle);
        updateCredentialsFolderStatus();
        alert('✅ Credentials folder connected successfully!\n\nPlease reload the page to apply the new credentials.');
      }
    } catch (error) {
      console.error('Error selecting credentials folder:', error);
      alert('❌ Failed to load credentials from folder. Please ensure the folder contains:\n- API Key.txt\n- Google sheet ID.txt\n- service-account.json');
    }
  }

  // Update credentials folder status display
  async function updateCredentialsFolderStatus() {
    const statusDiv = el('credentialsFolderStatus');
    const statusName = el('credentialsFolderName');
    if (!statusDiv || !statusName) return;

    try {
      const db = await openDB();
      const tx = db.transaction('handles', 'readonly');
      const store = tx.objectStore('handles');
      const handle = await store.get('invoiceApp_credentialsFolder');
      
      if (handle) {
        statusDiv.style.display = 'block';
        statusName.textContent = `✅ Connected to folder: ${handle.name}`;
      } else {
        statusDiv.style.display = 'none';
      }
    } catch (error) {
      statusDiv.style.display = 'none';
    }
  }

  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('InvoiceAppDB', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  // Expose
  window.openSettings = openSettings;
  window.closeSettings = closeSettings;
  window.applySettings = applySettings;
  window.selectCredentialsFolder = selectCredentialsFolder;
  window.settings = window.settings || {};
  window.settings.loadShowInactive = loadShowInactive;
  window.settings.saveShowInactive = saveShowInactive;
  window.settings.loadAutoLoad = loadAutoLoad;
  window.settings.saveAutoLoad = saveAutoLoad;

  // Auto-close on Escape
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape'){ const m = el('settingsModal'); if (m && m.style.display === 'flex') closeSettings(); } });

  // On page load, apply stored auto-load preference and trigger load if enabled
  window.addEventListener('load', function(){
    try {
      // Initialize radio state from stored value so UI reflects it without default HTML checked
      try {
        const rOff = document.getElementById('autoLoadOff'); const rOn = document.getElementById('autoLoadOn');
        if (rOff && rOn) {
          const auto = loadAutoLoad();
          if (auto === null) { rOff.checked = false; rOn.checked = false; }
          else { rOff.checked = !auto; rOn.checked = !!auto; }
          // attach immediate save handlers
          rOff.onchange = function(){ if (rOff.checked) { saveAutoLoad(false); console.log('settings: autoLoad saved -> false (via change)'); } };
          rOn.onchange = function(){ if (rOn.checked) { saveAutoLoad(true); console.log('settings: autoLoad saved -> true (via change)'); } };
        }
      } catch(e) {}

      // Only auto-load if stored preference explicitly set to true
      try {
        const auto = loadAutoLoad();
        if (auto === true && window.dataLoader && typeof window.dataLoader.loadFromGoogleSheets === 'function') {
          try { window.dataLoader.loadFromGoogleSheets(document.getElementById('sheetsLoadStatus')); } catch(e) { console.warn('Auto-load on startup failed', e); }
        }
      } catch(e) {}
    } catch(e) {}
  });

  console.log('settings.js loaded');
})();
