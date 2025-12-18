// bundle-ui-controls.js — helper functions for Bundle Manager UI
(function(){
  'use strict';

  function appendRow(tbody) {
    const tr = document.createElement('tr');
    if (window.bundleUtils && typeof window.bundleUtils.createBundleItemRow === 'function') {
      window.bundleUtils.createBundleItemRow(tr);
    } else {
      // Fallback inline row template
      tr.innerHTML = `\n        <td><input class="bundle-item-name" type="text"></td>\n        <td><input class="bundle-item-qty" type="number" min="0" value="1"></td>\n        <td><input class="bundle-item-price" type="number" min="0" step="0.01" value="0"></td>\n        <td class="bundle-item-total">0.00</td>\n        <td><button class="remove-item-btn btn btn-danger">X</button></td>\n      `;
    }

    tbody.appendChild(tr);
    const qty = tr.querySelector('.bundle-item-qty');
    const price = tr.querySelector('.bundle-item-price');
    const rm = tr.querySelector('.remove-item-btn');
    if (qty) qty.addEventListener('input', () => window.bundleUtils.updateRowTotal(tr));
    if (price) price.addEventListener('input', () => window.bundleUtils.updateRowTotal(tr));
    if (rm) rm.onclick = () => { tr.remove(); window.bundleUtils.updateGrandTotal(tbody); };
    window.bundleUtils.updateRowTotal(tr);
    return tr;
  }

  function clearForm(body, tbody, appendRowFn, updateButtonsState) {
    if (!body || !tbody) return;
    body.querySelector('#bundleName').value = '';
    body.querySelector('#bundleExpiry').value = '';
    body.querySelector('#bundleTextBefore').value = '';
    body.querySelector('#bundleDefendant').value = '';
    body.querySelector('#bundleTextAfter').value = '';
    body.querySelector('#bundleClientName').value = '';
    body.querySelector('#bundleNotes').value = '';
    tbody.innerHTML = '';
    appendRowFn(tbody);
    if (typeof updateButtonsState === 'function') updateButtonsState();
  }

  function loadBundle(idx, body, tbody, appendRowFn, updateButtonsState) {
    const bundles = (window.bundleModel && typeof window.bundleModel.getBundles === 'function') ? window.bundleModel.getBundles() : (window.bundlesData || []);
    if (!Array.isArray(bundles) || !bundles[idx]) return;
    const b = bundles[idx];
    body.querySelector('#bundleName').value = b.bundleName || '';
    body.querySelector('#bundleExpiry').value = b.bundleExpiry || '';
    body.querySelector('#bundleTextBefore').value = b.textBefore || '';
    body.querySelector('#bundleDefendant').value = b.defendant || '';
    body.querySelector('#bundleTextAfter').value = b.textAfter || '';
    body.querySelector('#bundleClientName').value = b.clientName || '';
    body.querySelector('#bundleNotes').value = b.notes || '';
    tbody.innerHTML = '';
    (b.items || []).forEach(it => {
      const tr = appendRowFn(tbody);
      try { tr.querySelector('.bundle-item-name').value = it.name || ''; } catch(e) {}
      try { tr.querySelector('.bundle-item-qty').value = it.qty || 0; } catch(e) {}
      try { tr.querySelector('.bundle-item-price').value = it.price || 0; } catch(e) {}
    });
    window.bundleUtils.updateGrandTotal(tbody);
    if (typeof updateButtonsState === 'function') updateButtonsState();
  }

  function populateClientDropdown(body) {
    const select = body.querySelector('#bundleClientName');
    if (!select) return;
    select.innerHTML = '<option value="">Select client</option>';
    const uniqueClients = new Set();
    const contactStatusMap = {};
    if (Array.isArray(window.clientsData) && window.clientsData.length) {
      window.clientsData.forEach(c => {
        const name = (c['Display Name'] || c['Client Name'] || c['Company Name'] || c['Name'] || '').toString().trim();
        if (!name) return;
        const st = (c['Status'] || c['status'] || '').toString().trim().toLowerCase();
        contactStatusMap[name.toLowerCase()] = st;
        uniqueClients.add(name);
      });
    }
    if (uniqueClients.size === 0 && Array.isArray(window.allInvoices)) {
      window.allInvoices.forEach(inv => {
        const n = (inv['Customer Name'] || inv['Client Name'] || '') || '';
        if (n) uniqueClients.add(n.toString().trim());
      });
    }
    const freq = {};
    (window.allInvoices || []).forEach(inv => {
      const cname = String(inv['Customer Name'] || inv['Client Name'] || '').trim();
      if (!cname) return;
      const k = cname.toLowerCase();
      freq[k] = (freq[k] || 0) + 1;
    });
    const sorted = Array.from(uniqueClients).sort((a,b)=>{
      const ca = freq[(a||'').toLowerCase()] || 0;
      const cb = freq[(b||'').toLowerCase()] || 0;
      if (cb - ca !== 0) return cb - ca;
      return a.localeCompare(b);
    });
    sorted.forEach(s => {
      const opt = document.createElement('option'); opt.value = s; opt.textContent = s.length > 35 ? s.substring(0,35) + '...' : s; opt.title = s; select.appendChild(opt);
    });
    if (sorted.length === 0) {
      const opt = document.createElement('option'); opt.value=''; opt.textContent='No clients found'; opt.disabled=true; select.appendChild(opt);
    }
  }

  window.bundleUIControls = {
    appendRow,
    clearForm,
    loadBundle,
    populateClientDropdown
  };

  console.log('bundle-ui-controls: ready');
})();
