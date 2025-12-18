// bundle-utils.js — DOM and math helpers for bundle UI
(function(){
  'use strict';

  function createBundleItemRow(tr) {
    tr.innerHTML = `\n      <td><input type="text" class="bundle-item-name" placeholder="Item name"></td>\n      
    <td><input type="number" class="bundle-item-qty" min="0" step="1" value="1"></td>\n      
    <td><input type="number" class="bundle-item-price" min="0" step="0.01" value="0.00"></td>\n  
        <td style=""><select class="bundle-item-taxable"><option value="Standard">Standard</option><option value="Exempt">Exempt</option><option value="Zero-rate">Zero-rate</option></select></td>\n      
        <td class="bundle-item-total">0.00</td>\n     
         <td class="actions-col"><button type=\"button\" class=\"remove-btn\" title=\"Remove item\">X</button></td>\n    `;
  }

  function updateRowTotal(tr) {
    const qtyEl = tr.querySelector('.bundle-item-qty');
    const priceEl = tr.querySelector('.bundle-item-price');
    const totalEl = tr.querySelector('.bundle-item-total');
    const qty = parseFloat(qtyEl?.value || 0) || 0;
    const price = parseFloat(priceEl?.value || 0) || 0;
    const total = qty * price;
    if (totalEl) totalEl.textContent = total.toFixed(2);
    updateGrandTotal(tr.closest('tbody'));
  }

  function updateGrandTotal(tbody) {
    if (!tbody) return;
    const totalCells = tbody.querySelectorAll('.bundle-item-total');
    let sum = 0;
    totalCells.forEach(td => { sum += parseFloat(td.textContent || 0) || 0; });
    const grandEl = tbody.closest('.table-scroll').querySelector('#bundleItemsGrandTotal');
    if (grandEl) grandEl.textContent = sum.toFixed(2);
  }

  window.bundleUtils = {
    createBundleItemRow,
    updateRowTotal,
    updateGrandTotal
  };

  console.log('bundle-utils: ready');
})();
