// bundle-ui-save.js — save/append helper for the Bundle Manager
(function(){
  'use strict';

  async function performSave({ showStatus = true } = {}) {
    // Use DOM selectors the same way bundle-ui used them
    const statusEl = document.getElementById('bundlesSaveStatus');
    const saveBtn = document.getElementById('saveBundleBtn');
    const bundleName = document.getElementById('bundleName')?.value.trim() || '';
    const bundleExpiry = document.getElementById('bundleExpiry')?.value || '';
    const textBefore = document.getElementById('bundleTextBefore')?.value.trim() || '';
    const defendant = document.getElementById('bundleDefendant')?.value.trim() || '';
    const textAfter = document.getElementById('bundleTextAfter')?.value.trim() || '';
    const clientName = document.getElementById('bundleClientName')?.value.trim() || '';
    const notes = document.getElementById('bundleNotes')?.value.trim() || '';

    if (!bundleName) { if (showStatus) alert('Please enter bundle name'); return false; }

    const tbody = document.getElementById('bundleItemsBody');
    const items = [];
    tbody.querySelectorAll('tr').forEach(tr => {
      const name = tr.querySelector('.bundle-item-name')?.value.trim() || '';
      const qty = parseFloat(tr.querySelector('.bundle-item-qty')?.value || 0) || 0;
      const price = parseFloat(tr.querySelector('.bundle-item-price')?.value || 0) || 0;
      const taxable = tr.querySelector('.bundle-item-taxable')?.value || 'Standard';
      const total = qty * price;
      if (!name) return;
      items.push({ name, qty, price, taxable, total });
    });
    if (items.length === 0) { if (showStatus) alert('Please add at least one item to the bundle'); return false; }

    // Get / set currentIndex via manager global so we don't rely on closure state
    const curIdx = (window._bundleManagerGlobal && typeof window._bundleManagerGlobal.getCurrentBundleIndex === 'function') ? window._bundleManagerGlobal.getCurrentBundleIndex() : null;

    // choose createdDate
    function formatDateForSheet(input) {
      if (!input && input !== 0) return '';
      if (input instanceof Date) {
        const d = input;
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
      }
      const s = String(input).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const [y, m, d] = s.split('-');
        return `${d.padStart(2,'0')}/${m.padStart(2,'0')}/${y}`;
      }
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) return s;
      const tryDate = new Date(s);
      if (!isNaN(tryDate)) return formatDateForSheet(tryDate);
      return s;
    }

    const existingBundle = (window.bundleModel && typeof window.bundleModel.getBundles === 'function' && curIdx !== null && window.bundleModel.getBundles()[curIdx]) ? window.bundleModel.getBundles()[curIdx] : (Array.isArray(window.bundlesData) && curIdx !== null ? window.bundlesData[curIdx] : null);
    const createdDateVal = curIdx == null ? formatDateForSheet(new Date()) : (existingBundle && (existingBundle.createdDate || existingBundle['Created Date']) ? (existingBundle.createdDate || existingBundle['Created Date']) : formatDateForSheet(new Date()));
    const lastModifiedVal = formatDateForSheet(new Date());

    const bundle = {
      id: curIdx == null ? ('bundle-' + Date.now()) : (existingBundle && existingBundle.id ? existingBundle.id : ('bundle-' + Date.now())),
      bundleName,
      bundleExpiry,
      textBefore,
      defendant,
      textAfter,
      clientName,
      items,
      notes,
      'Created Date': createdDateVal,
      'Create Date': createdDateVal,
      createdDate: createdDateVal,
      lastModified: lastModifiedVal
    };

    try {
      if (showStatus && saveBtn) saveBtn.disabled = true;
      if (showStatus && statusEl) { statusEl.classList.remove('success','warn'); statusEl.textContent = '⏳ Saving bundle...'; }
      let savedOk = false;

      if (curIdx === null) {
        if (typeof window.appendBundleToGoogleSheets === 'function') {
          const resp = await window.appendBundleToGoogleSheets(bundle, showStatus ? statusEl : null).catch(e => ({ ok: false, error: e }));
          if (resp && resp.ok) {
            if (typeof window.loadBundlesFromGoogleSheets === 'function') await window.loadBundlesFromGoogleSheets();
            savedOk = true;
            // update index to last
            const newIndex = (window.bundleModel && typeof window.bundleModel.findLastIndex === 'function') ? window.bundleModel.findLastIndex() : ((window.bundlesData || []).length - 1);
            if (window._bundleManagerGlobal && typeof window._bundleManagerGlobal.setCurrentBundleIndex === 'function') window._bundleManagerGlobal.setCurrentBundleIndex(newIndex);
            if (showStatus && window.uiFeedback && window.uiFeedback.showNavigationFeedback) window.uiFeedback.showNavigationFeedback('✅ Bundle saved and appended to Google Sheets');
            if (showStatus && statusEl) statusEl.classList.add('success');
          } else {
            // fallback local
            if (window.bundleModel && typeof window.bundleModel.addBundle === 'function') { window.bundleModel.addBundle(bundle); } else { window.bundlesData = window.bundlesData || []; window.bundlesData.push(bundle); try { localStorage.setItem('invoiceApp_bundles', JSON.stringify(window.bundlesData)); } catch(e) {} }
            savedOk = true;
            const newIndex = (window.bundleModel && typeof window.bundleModel.findLastIndex === 'function') ? window.bundleModel.findLastIndex() : ((window.bundlesData || []).length - 1);
            if (window._bundleManagerGlobal && typeof window._bundleManagerGlobal.setCurrentBundleIndex === 'function') window._bundleManagerGlobal.setCurrentBundleIndex(newIndex);
            if (showStatus && window.uiFeedback && window.uiFeedback.showNavigationWarning) window.uiFeedback.showNavigationWarning('Saved locally but failed to append to Google Sheets');
            if (showStatus && statusEl) statusEl.classList.add('warn');
          }
        } else {
          // no sheets client: local only
          if (window.bundleModel && typeof window.bundleModel.addBundle === 'function') { window.bundleModel.addBundle(bundle); } else { window.bundlesData = window.bundlesData || []; window.bundlesData.push(bundle); try { localStorage.setItem('invoiceApp_bundles', JSON.stringify(window.bundlesData)); } catch(e) {} }
          savedOk = true;
          const newIndex = (window.bundleModel && typeof window.bundleModel.findLastIndex === 'function') ? window.bundleModel.findLastIndex() : ((window.bundlesData || []).length - 1);
          if (window._bundleManagerGlobal && typeof window._bundleManagerGlobal.setCurrentBundleIndex === 'function') window._bundleManagerGlobal.setCurrentBundleIndex(newIndex);
          if (showStatus && window.uiFeedback && window.uiFeedback.showNavigationFeedback) window.uiFeedback.showNavigationFeedback('✅ Bundle saved locally');
          if (showStatus && statusEl) statusEl.classList.add('success');
        }
      } else {
        // update existing - sync deleted items with Google Sheets first
        if (typeof window.syncBundleItemsOnUpdate === 'function') {
          if (showStatus && statusEl) { statusEl.textContent = '⏳ Syncing changes to Google Sheets...'; }
          await window.syncBundleItemsOnUpdate();
        }
        
        // Update local model
        if (window.bundleModel && typeof window.bundleModel.updateBundle === 'function') { window.bundleModel.updateBundle(curIdx, bundle); savedOk = true; }
        else if (Array.isArray(window.bundlesData) && window.bundlesData[curIdx]) { window.bundlesData[curIdx] = bundle; try { localStorage.setItem('invoiceApp_bundles', JSON.stringify(window.bundlesData)); } catch(e) {} savedOk = true; }
        if (showStatus && window.uiFeedback && window.uiFeedback.showNavigationFeedback) window.uiFeedback.showNavigationFeedback('✅ Bundle updated');
        if (showStatus && statusEl) statusEl.classList.add('success');
      }

      return savedOk;
    } catch (err) {
      console.error('bundle-ui-save: save error', err);
      if (showStatus && statusEl) { statusEl.textContent = `⚠️ ${err && err.message ? err.message : 'Failed to save bundle'}`; statusEl.classList.remove('success'); statusEl.classList.add('warn'); }
      return false;
    } finally {
      if (showStatus && saveBtn) saveBtn.disabled = false;
      if (showStatus) setTimeout(() => { try { if (statusEl) { statusEl.textContent = ''; statusEl.classList.remove('success','warn'); } } catch(e) {} }, 4000);
    }
  }

  window.bundleUISave = {
    performSave
  };

  console.log('bundle-ui-save: ready');
})();
