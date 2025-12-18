// tax_utils.js — small tax-related helpers
(function(){
  'use strict';

  function deriveTaxTypeFromPercent(rawPct) {
    const s = (rawPct !== undefined && rawPct !== null) ? String(rawPct).trim() : '';
    if (s === '-' || s === '') return { taxType: 'exempt', pctValue: '' };
    const pct = parseFloat(String(s).replace('%','')) || 0;
    if (Math.abs(pct - 5) < 0.0001) return { taxType: 'standard rate', pctValue: '5' };
    if (Math.abs(pct - 0) < 0.0001) return { taxType: 'zero rate', pctValue: '0' };
    return { taxType: 'exempt', pctValue: '' };
  }

  window.taxUtils = window.taxUtils || {};
  window.taxUtils.deriveTaxTypeFromPercent = deriveTaxTypeFromPercent;
})();
