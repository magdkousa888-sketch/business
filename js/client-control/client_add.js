// client_add.js — manual client modal and validation handlers
(function(){
  'use strict';

  // Helpers for DOM lookups
  function $id(id){ return document.getElementById(id); }

  // Remove validation styling and helper messages
  function removeValidationStyling(field){
    if (!field) return;
    field.classList.remove('error');
    field.style.borderColor = '';
    field.style.backgroundColor = '';
    field.title = '';
    const existingMessages = field.parentNode.querySelectorAll('.validation-message, .checking-message, .error-message');
    existingMessages.forEach(el => el.remove());
  }

  function showValidationError(field, message){
    if (!field) return;
    const existingError = field.parentNode.querySelector('.error-message');
    if (existingError) existingError.remove();

    field.classList.add('error');
    field.style.borderColor = '#dc2626';
    field.style.backgroundColor = '#fef2f2';

    const errorElement = document.createElement('span');
    errorElement.className = 'error-message';
    errorElement.textContent = message;
    errorElement.style.color = '#dc2626';
    errorElement.style.fontSize = '11px';
    errorElement.style.marginTop = '4px';
    errorElement.style.display = 'block';
    field.parentNode.appendChild(errorElement);
  }

  function showValidationSuccess(field, message){
    if (!field) return;
    removeValidationStyling(field);
    field.classList.remove('error');
    field.style.borderColor = '#059669';
    field.style.backgroundColor = '#f0fdf4';

    let successMsg = field.parentNode.querySelector('.validation-message');
    if (!successMsg){
      successMsg = document.createElement('span');
      successMsg.className = 'validation-message success-message';
      field.parentNode.appendChild(successMsg);
    }
    successMsg.textContent = message;
    successMsg.style.color = '#059669';
    successMsg.style.fontSize = '11px';
    successMsg.style.fontWeight = '500';
    successMsg.style.marginTop = '4px';
    successMsg.style.display = 'block';

    setTimeout(() => {
      if (successMsg && successMsg.parentNode){
        successMsg.style.opacity = '0';
        setTimeout(()=>{ if (successMsg.parentNode) successMsg.remove(); field.style.borderColor = ''; field.style.backgroundColor = ''; }, 300);
      }
    }, 3000);
  }

  function showCheckingIndicator(field){
    if (!field) return;
    removeValidationStyling(field);
    field.style.borderColor = '#fbbf24';
    field.style.backgroundColor = '#fefbf0';
    let checkingMsg = field.parentNode.querySelector('.checking-message');
    if (!checkingMsg){ checkingMsg = document.createElement('span'); checkingMsg.className = 'checking-message'; field.parentNode.appendChild(checkingMsg); }
    checkingMsg.textContent = '🔍 Checking...';
    checkingMsg.style.color = '#f59e0b'; checkingMsg.style.fontSize = '11px'; checkingMsg.style.fontWeight = '500'; checkingMsg.style.marginTop = '4px'; checkingMsg.style.display = 'block';
  }

  function removeCheckingIndicator(field){
    if (!field) return;
    const checkingMsg = field.parentNode.querySelector('.checking-message');
    if (checkingMsg) checkingMsg.remove();
  }

  // Modal open/close
  function openManualClientPopup(){
    const modal = $id('manualClientModal');
    if (!modal) return;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    $id('manualClientForm').reset();
    clearAllValidationStyling();

    setTimeout(()=>{
      const nameField = $id('manualDisplayName');
      if (nameField){ nameField.focus(); initializeValidationEvents(); }
    }, 100);
  }

  function closeManualClientPopup(){
    const modal = $id('manualClientModal'); if (!modal) return;
    modal.style.display = 'none'; document.body.style.overflow = 'auto'; clearFormErrors();
  }

  function clearFormErrors(){
    document.querySelectorAll('.form-group input, .form-group select').forEach(el => el.classList.remove('error'));
    document.querySelectorAll('.error-message').forEach(el => el.remove());
  }

  function clearAllValidationStyling(){
    const fields = ['manualCompanyName','manualDisplayName','manualAddress1','manualAddress2','manualCity','manualCountry','manualTRN','manualProjectCode','manualContactName','manualMobilePhone','manualEmailID'];
    fields.forEach(id => { const f = $id(id); if (f) removeValidationStyling(f); });
  }

  // Validation + conflict checks
  function validateManualClientForm(){
    // Required fields per new policy
    const required = [{id:'manualDisplayName',name:'Display Name'},{id:'manualCompanyName',name:'Company Name'}];
    let isValid = true; const errors = [];
    required.forEach(f=>{ const el = $id(f.id); if (!el || !el.value.trim()){ if (el) { el.classList.add('error'); showValidationError(el, `${f.name} is required`);} errors.push(f.name); isValid=false; }});

    const nameField = $id('manualDisplayName'); const trnField = $id('manualTRN');
    if (nameField && nameField.classList.contains('error')){ errors.push('Client name conflict'); isValid=false; }
    if (trnField && trnField.classList.contains('error')){ errors.push('TRN number conflict'); isValid=false; }

    const clientName = nameField ? nameField.value.trim() : '';
    const clientTRN = trnField ? trnField.value.trim() : '';

    if (clientName && clientTRN && isValid && (window.clientsData && window.clientsData.length>0)){
      const clientWithSameName = (window.clientsData||[]).find(c=>{ const existing = c['Display Name']||c['Client Name']||c['Name']||c['name']||c['CLIENT NAME']||c['client_name']||''; return existing.toLowerCase()===clientName.toLowerCase(); });
      const clientWithSameTRN = (window.clientsData||[]).find(c=>{ const existingTRN = c['Tax Registration Number']||c['TRN Number']||c['TRN']||c['trn_number']||c['trn']||''; return existingTRN && existingTRN.toLowerCase()===clientTRN.toLowerCase(); });
      if (clientWithSameName && clientWithSameTRN && clientWithSameName!==clientWithSameTRN){ showValidationError(nameField,'Name and TRN belong to different clients'); showValidationError(trnField,'Name and TRN belong to different clients'); errors.push('Cross-reference conflict'); isValid=false; }
    }

    return { isValid, errors };
  }

  function checkForExistingClient(clientName, clientTRN){
    const clients = window.clientsData || [];
    if (clients.length===0) return { exists:false, type:null, existingClient:null };
    const nameToCheck = (clientName||'').toLowerCase().trim();
    const trnToCheck = clientTRN ? clientTRN.toLowerCase().trim() : null;

    const clientWithSameName = clients.find(client=>{ const existingName = client['Display Name']||client['Client Name']||client['Name']||client['name']||client['CLIENT NAME']||client['client_name']||''; return existingName.toLowerCase().trim()===nameToCheck; });
    let clientWithSameTRN = null; if (trnToCheck){ clientWithSameTRN = clients.find(client=>{ const existingTRN = client['Tax Registration Number']||client['TRN Number']||client['TRN']||client['trn_number']||client['trn']||''; return existingTRN && existingTRN.toLowerCase().trim()===trnToCheck; }); }

    if (clientWithSameName && clientWithSameTRN){ if (clientWithSameName===clientWithSameTRN){ return { exists:true, type:'exact_match', existingClient: clientWithSameName, message:'Exact client already exists (same name and TRN)' }; } else { return { exists:true, type:'cross_conflict', existingClient: { name: clientWithSameName, trn: clientWithSameTRN }, message: 'Name and TRN belong to different existing clients' }; } }
    if (clientWithSameName) return { exists:true, type:'name_conflict', existingClient: clientWithSameName, message:'Client name already exists' };
    if (clientWithSameTRN) return { exists:true, type:'trn_conflict', existingClient: clientWithSameTRN, message:'TRN number already exists' };
    return { exists:false, type:null, existingClient:null };
  }

  function showClientConflictDetails(conflictInfo){
    let message = "❌ Cannot add client due to conflicts:\n\n";
    switch(conflictInfo.type){
      case 'exact_match':{
        const existingClient = conflictInfo.existingClient;
        message += "🔍 EXACT MATCH FOUND:\n";
        message += `• Name: ${existingClient['Display Name']||existingClient['Client Name']||'N/A'}\n`;
        message += `• TRN: ${existingClient['Tax Registration Number']||existingClient['TRN Number']||'N/A'}\n`;
        message += `• Address: ${existingClient['Billing Address']||existingClient['Address Line 1']||'N/A'}\n`;
        message += `• City: ${existingClient['City']||'N/A'}\n`;
        message += `• Country: ${existingClient['Country']||'N/A'}\n\n`;
        message += "✅ This client already exists in your database.\n💡 You can select it from the dropdown instead.";
        break; }
      case 'name_conflict':{
        const nameClient = conflictInfo.existingClient;
        message += `🏷️ CLIENT NAME CONFLICT:\n• Existing client: ${nameClient['Display Name']||nameClient['Client Name']||'N/A'}\n• Existing TRN: ${nameClient['Tax Registration Number']||nameClient['TRN Number']||'N/A'}\n\n⚠️ A client with this name already exists.`;
        break; }
      case 'trn_conflict':{
        const trnClient = conflictInfo.existingClient;
        message += `🔢 TRN NUMBER CONFLICT:\n• Existing client: ${trnClient['Display Name']||trnClient['Client Name']||'N/A'}\n• Your display name: ${$id('manualDisplayName') ? $id('manualDisplayName').value : 'N/A'}\n\n⚠️ This TRN number is already assigned to another client.`;
        break; }
      case 'cross_conflict':{
        message += `🔀 CROSS-REFERENCE CONFLICT:\n• Name belongs to: ${conflictInfo.existingClient.name['Display Name']||conflictInfo.existingClient.name['Client Name']||'N/A'}\n• TRN belongs to: ${conflictInfo.existingClient.trn['Display Name']||conflictInfo.existingClient.trn['Client Name']||'N/A'}\n\n⚠️ The name and TRN you entered belong to different existing clients.`;
        break; }
    }
    // conflicts should not show blocking popups — log them instead
    console.warn('Client conflict (suppressed message):', message);
  }

  // Check existing client name / TRN and show inline feedback
  function checkClientNameAvailability(clientName){
    const nameField = $id('manualDisplayName'); if (!nameField) return;
    removeCheckingIndicator(nameField);
    const clients = window.clientsData || [];
    if (clients.length === 0) { showValidationSuccess(nameField, '✅ Available'); return; }
    const existingClient = clients.find(client=>{ const existingName = client['Display Name']||client['Client Name']||client['Name']||client['name']||client['CLIENT NAME']||client['client_name']||""; return existingName.toLowerCase().trim() === clientName.toLowerCase().trim(); });
    if (existingClient){ const existingTRN = existingClient['TRN Number']||existingClient['TRN']||'N/A'; const existingCity = existingClient['City']||'N/A'; showValidationError(nameField, `❌ Client exists (TRN: ${existingTRN}, City: ${existingCity})`); nameField.title = `Existing client details:\n• Name: ${existingClient['Display Name']||existingClient['Client Name']||'N/A'}\n• TRN: ${existingTRN}\n• City: ${existingCity}`; } else { showValidationSuccess(nameField,'✅ Available'); nameField.title = 'Client name is available'; }
  }

  function checkTRNAvailability(trn){
    const trnField = $id('manualTRN'); if (!trnField) return; removeCheckingIndicator(trnField);
    const clients = window.clientsData || []; if (clients.length===0){ showValidationSuccess(trnField, '✅ Available'); return; }
    const existingClient = clients.find(client=>{ const existingTRN = client['TRN Number']||client['TRN']||client['trn_number']||client['trn']||""; return existingTRN && existingTRN.toLowerCase().trim()===trn.toLowerCase().trim(); });
    if (existingClient){ const existingName = existingClient['Display Name']||existingClient['Client Name']||'Unknown'; const existingCity = existingClient['City']||'N/A'; showValidationError(trnField, `❌ TRN used by: ${existingName} (${existingCity})`); trnField.title = `TRN already belongs to:\n• Client: ${existingName}\n• City: ${existingCity}`; } else { showValidationSuccess(trnField,'✅ Available'); trnField.title = 'TRN number is available'; }
  }

  // Save manual client – use clientManager APIs if available
  async function saveManualClient(){
    const validation = validateManualClientForm();
    if (!validation.isValid) return;

    const displayName = $id('manualDisplayName').value.trim();
    const companyName = $id('manualCompanyName').value.trim();
    const clientTRN = $id('manualTRN').value.trim();

    const conflictInfo = checkForExistingClient(displayName, clientTRN);
    if (conflictInfo.exists){ showClientConflictDetails(conflictInfo); return; }

    const saveBtn = document.querySelector('.save-client-btn'); if (saveBtn){ saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }

    try {
      const contactName = $id('manualContactName') ? $id('manualContactName').value.trim() : '';
      const mobilePhone = $id('manualMobilePhone') ? $id('manualMobilePhone').value.trim() : '';
      const emailID = $id('manualEmailID') ? $id('manualEmailID').value.trim() : '';

      const newClient = {
        'Display Name': displayName,
        'Company Name': companyName,
        'Client Name': displayName,
        'Billing Address': $id('manualAddress1').value.trim(),
        'Address Line 1': $id('manualAddress1').value.trim(),
        'Address Line 2': $id('manualAddress2').value.trim(),
        'City': $id('manualCity').value.trim(),
        'Country': $id('manualCountry').value.trim(),
        // Keep only one canonical TRN field for contacts to avoid duplicate columns on append
        'Tax Registration Number': clientTRN,
        'TRN Number': clientTRN,
        'Project Code': $id('manualProjectCode').value.trim(),
        'Contact Name': contactName || '',
        'EmailID': emailID || '',
        'MobilePhone': mobilePhone || '',
        'manually_added': true,
        'date_added': new Date().toISOString().split('T')[0],
        'added_by': 'manual_entry'
      };

      window.clientsData = window.clientsData || [];
      window.clientsData.push(newClient);

      // Helper: compute final Contacts row that would be sent (re-usable for preview/tests)
      function getContactsAppendRow(contactsObj, { preferIndexMap = true, indexMap = null } = {}){
        try {
          // allow callers to pass an indexMap override (fresh mapping); otherwise use cache
          let resolvedIndexMap = indexMap;
          if (!resolvedIndexMap && typeof window.getColumnsIndexCached === 'function') resolvedIndexMap = window.getColumnsIndexCached('Contacts') || null;
          // For preview, do not call async loader here. If cache is empty the code will fall back to HEADER_ORDER
          if (resolvedIndexMap && Object.keys(resolvedIndexMap).length > 0 && preferIndexMap) {
            const numericKeys = Object.keys(resolvedIndexMap).filter(k => Number.isFinite(resolvedIndexMap[k]));
            if (numericKeys.length > 0) {
              const maxIndex = Math.max(...numericKeys.map(k => resolvedIndexMap[k]));
              const arr = new Array(maxIndex + 1).fill('');
              const objNorm = {};
              Object.keys(contactsObj||{}).forEach(key => objNorm[String(key).trim().toLowerCase()] = contactsObj[key]);
              if ((!objNorm['tax registration number'] || objNorm['tax registration number'] === '') && objNorm['trn number']) objNorm['tax registration number'] = objNorm['trn number'];
              if ((!objNorm['tax registration number'] || objNorm['tax registration number'] === '') && objNorm['trn']) objNorm['tax registration number'] = objNorm['trn'];
              Object.keys(resolvedIndexMap).forEach(k => {
                const idx = resolvedIndexMap[k]; if (!Number.isFinite(idx)) return; const normKey = String(k).trim().toLowerCase(); const val = objNorm.hasOwnProperty(normKey) ? objNorm[normKey] : ''; arr[idx] = (val === undefined || val === null) ? '' : String(val);
              });
              return arr;
            }
          }

          // Fallback header order
          const HEADER_ORDER = ['Display Name','Company Name','Contact Name','EmailID','MobilePhone','Tax Registration Number','Billing Address','City','Country','Notes'];
          return HEADER_ORDER.map(h => contactsObj[h] !== undefined && contactsObj[h] !== null ? String(contactsObj[h]) : '');
        } catch (e) { console.warn('getContactsAppendRow helper error', e); return null; }
      }

      // Attempt to append the new client to the Contacts sheet using client-side Columns Index mapping
      try {
        const contactsObj = Object.assign({}, newClient);

        // Prefer a fresh mapping from Columns Index sheet (force) to avoid stale cached indexes
        let indexMap = null;
        if (typeof window.loadColumnsIndexFromSheet === 'function') {
          try {
            indexMap = await window.loadColumnsIndexFromSheet('Contacts', { force: true });
          } catch (e) {
            console.warn('Could not force-load Columns Index for Contacts (fall back to cache):', e && e.message ? e.message : e);
            if (typeof window.getColumnsIndexCached === 'function') indexMap = window.getColumnsIndexCached('Contacts') || null;
          }
        } else if (typeof window.getColumnsIndexCached === 'function') {
          indexMap = window.getColumnsIndexCached('Contacts') || null;
        }
        // Build row using helper (prefers client Columns Index mapping when available) — pass the freshly loaded map if available
        let rowToAppend = getContactsAppendRow(contactsObj, { preferIndexMap: true, indexMap: indexMap });

        if (rowToAppend) {
          // Diagnostic: show what we're about to append so we can verify mapping in development
          try {
            const preview = {
              dataset: 'Contacts',
              indexMap: indexMap || null,
              rowLength: Array.isArray(rowToAppend) ? rowToAppend.length : (rowToAppend && rowToAppend.length) || 0,
              rowPreview: Array.isArray(rowToAppend) ? rowToAppend.slice(0, 20) : rowToAppend
            };
            console.log('DEBUG: Contacts append preview', preview);
            // If debug flag is set, avoid actually appending and return early
            if (window.DEBUG_PREVIEW_APPEND === true) {
              console.log('DEBUG_PREVIEW_APPEND set — skipping actual append (non-destructive)');
            } else if (window.ServiceAccountAuth && typeof window.ServiceAccountAuth.fetch === 'function') {
              try {
                const SPREADSHEET_ID = window.GOOGLE_SPREADSHEET_ID || '17gh8MZSeFVPQudyTGwYf5_pFWH8yt-xpCPiPy9i8x-U';
                const SHEET_NAME = 'Contacts';
                const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_NAME}!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
                await window.ServiceAccountAuth.fetch(appendUrl, { method: 'POST', body: JSON.stringify({ values: [rowToAppend] }) });
                console.log('Attempted to append new contact to Contacts sheet');
              } catch (e) { console.warn('Failed to append new contact to Contacts sheet', e); }
            }
          } catch (ex) { console.warn('Error while preparing contacts append preview', ex); }
        }
      } catch (e) { console.warn('Error while attempting to persist new client to Contacts sheet', e); }

      // NOTE: Do NOT persist manual clients to localStorage here; persistence removed per request.

      // Log the event to System Logs (non-blocking)
      try {
        if (window.sessionLogger && typeof window.sessionLogger.appendEvent === 'function') {
          window.sessionLogger.appendEvent('add_contact', { displayName: displayName, companyName: companyName, trn: clientTRN });
        }
      } catch(e) { console.warn('session_logger appendEvent failed for add_contact', e); }

      if (window.clientManager && typeof window.clientManager.refreshAllClientReferences === 'function') window.clientManager.refreshAllClientReferences();
      if (typeof refreshAllClientReferences === 'function') refreshAllClientReferences();

      // auto-select newly added
      const dropdown = $id('clientDropdown'); if (dropdown){ dropdown.value = (window.clientsData.length - 1).toString(); if (typeof selectClient === 'function') selectClient(); }

      // update upload status logic used elsewhere
      csvFileUploaded = true;
      if (typeof updateUploadStatus === 'function') updateUploadStatus();

      // Close the modal silently and re-enable save button (no persistence, no popups)
      setTimeout(()=>{ closeManualClientPopup(); if (saveBtn){ saveBtn.disabled = false; saveBtn.textContent = 'Save Client'; } }, 300);

    } catch(err){ console.error('saveManualClient error', err); if (saveBtn){ saveBtn.disabled = false; saveBtn.textContent = 'Save Client'; } }
  }

  // Initialize validation events on modal fields
  function initializeValidationEvents(){
    const displayField = $id('manualDisplayName'); const companyField = $id('manualCompanyName'); const trnField = $id('manualTRN');
    if (displayField && !displayField.hasAttribute('data-validation-initialized')){
      displayField.setAttribute('data-validation-initialized', 'true');
      // by default mark display as auto-set so it follows company name until user edits
      if (!displayField.hasAttribute('data-auto-set')) displayField.setAttribute('data-auto-set', 'true');
      let typingTimer; const typingDelay = 500;
      displayField.addEventListener('keydown', function(){ clearTimeout(typingTimer); removeValidationStyling(this); displayField.setAttribute('data-auto-set','false'); });
      displayField.addEventListener('input', function(){ /* user typed — mark custom */ displayField.setAttribute('data-auto-set','false'); });
      displayField.addEventListener('keyup', function(){ clearTimeout(typingTimer); const v = this.value.trim(); if (v.length>0){ showCheckingIndicator(this); typingTimer = setTimeout(()=> checkClientNameAvailability(v), typingDelay); } else removeValidationStyling(this); });
      displayField.addEventListener('blur', function(){ const v=this.value.trim(); if (v) checkClientNameAvailability(v); });
    }

    // company name field should default display name unless user has edited display manually
    if (companyField && !companyField.hasAttribute('data-auto-initialized')){
      companyField.setAttribute('data-auto-initialized','true');
      companyField.addEventListener('input', function(){ try {
        const d = $id('manualDisplayName'); if (!d) return; const auto = d.getAttribute('data-auto-set');
        if (auto === null || auto === 'true' || d.value.trim()==='') { d.value = this.value; d.setAttribute('data-auto-set','true'); }
      } catch(e){} });
    }

    if (trnField && !trnField.hasAttribute('data-validation-initialized')){
      trnField.setAttribute('data-validation-initialized','true'); let trnTypingTimer; const typingDelay=800;
      trnField.addEventListener('keydown', function(){ clearTimeout(trnTypingTimer); removeValidationStyling(this); });
      trnField.addEventListener('keyup', function(){ clearTimeout(trnTypingTimer); const v=this.value.trim(); if (v.length>0){ showCheckingIndicator(this); trnTypingTimer = setTimeout(()=> checkTRNAvailability(v), typingDelay); } else removeValidationStyling(this); });
      trnField.addEventListener('blur', function(){ const v=this.value.trim(); if (v) checkTRNAvailability(v); });
    }
  }

  // DOM ready – attach click handlers for modal buttons
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ()=>{
    // attach onclicks (buttons in markup already use functions but keep good measure)
    const modalSave = document.querySelector('#manualClientModal .save-client-btn'); if (modalSave) modalSave.addEventListener('click', saveManualClient);
    const modalClose = document.querySelector('#manualClientModal .cancel-btn'); if (modalClose) modalClose.addEventListener('click', closeManualClientPopup);
  });

  // Expose functions globally for existing onclick attributes
  window.openManualClientPopup = openManualClientPopup;
  window.closeManualClientPopup = closeManualClientPopup;
  window.saveManualClient = saveManualClient;
  window.validateManualClientForm = validateManualClientForm;
  window.checkClientNameAvailability = checkClientNameAvailability;
  window.checkTRNAvailability = checkTRNAvailability;
  window.checkForExistingClient = checkForExistingClient;
  window.showClientConflictDetails = showClientConflictDetails;
  // Preview helper for developers: builds the Contacts row and prints it to console without appending
  window.previewManualClientAppend = async function({ force = true } = {}){
    try {
      const contactsObj = {
        'Display Name': $id('manualDisplayName') ? $id('manualDisplayName').value.trim() : '',
        'Company Name': $id('manualCompanyName') ? $id('manualCompanyName').value.trim() : '',
        'Contact Name': $id('manualContactName') ? $id('manualContactName').value.trim() : '',
        'EmailID': $id('manualEmailID') ? $id('manualEmailID').value.trim() : '',
        'MobilePhone': $id('manualMobilePhone') ? $id('manualMobilePhone').value.trim() : '',
        'Tax Registration Number': $id('manualTRN') ? $id('manualTRN').value.trim() : '',
        'Billing Address': $id('manualAddress1') ? $id('manualAddress1').value.trim() : '',
        'City': $id('manualCity') ? $id('manualCity').value.trim() : '',
        'Country': $id('manualCountry') ? $id('manualCountry').value.trim() : ''
      };
      // Try to pull a fresh mapping if requested
      let indexMap = null;
      if (force && typeof window.loadColumnsIndexFromSheet === 'function') {
        try { indexMap = await window.loadColumnsIndexFromSheet('Contacts', { force: true }); } catch (e) { indexMap = indexMap || null; }
      }
      const row = getContactsAppendRow(contactsObj, { preferIndexMap: true, indexMap: indexMap });
      console.log('MANUAL CLIENT APPEND PREVIEW', { contactsObj, rowLength: row ? row.length : 0, sampleRow: Array.isArray(row) ? row.slice(0, 30) : row });
      try { alert('Manual client append preview written to console (open devtools). Sample columns shown in console.'); } catch (e) {}
    } catch (e) { console.warn('previewManualClientAppend failed', e); }
  };
  // convenience helper (old code expects showFieldError)
  window.showFieldError = function(fieldId, message){
    const f = document.getElementById(fieldId);
    if (f) showValidationError(f, message);
  };

  console.log('✅ client_add module loaded');

})();
