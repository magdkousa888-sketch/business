// helpers.js — small reusable helpers for invoice update
(function(){
  'use strict';

  function colToA1(n) {
    let s = '';
    while (n >= 0) {
      s = String.fromCharCode((n % 26) + 65) + s;
      n = Math.floor(n / 26) - 1;
    }
    return s;
  }

  async function loadIndexMap(sheetName, { force = false } = {}) {
    let indexMap = null;
    if (typeof window.loadColumnsIndexFromSheet === 'function') {
      try { indexMap = await window.loadColumnsIndexFromSheet(sheetName, { force }); } catch (e) { indexMap = (typeof window.getColumnsIndexCached === 'function') ? window.getColumnsIndexCached(sheetName) : null; }
    } else if (typeof window.getColumnsIndexCached === 'function') {
      indexMap = window.getColumnsIndexCached(sheetName) || null;
    }
    return indexMap;
  }

  function findInIndexMap(candidates, indexMap) {
    if (!indexMap) return -1;
    const keys = Object.keys(indexMap || {});
    for (const c of (Array.isArray(candidates)?candidates:[candidates])) {
      if (Object.prototype.hasOwnProperty.call(indexMap, c) && Number.isFinite(indexMap[c])) return indexMap[c];
    }
    const lowerCandidates = (Array.isArray(candidates)?candidates:[candidates]).map(s => String(s||'').toLowerCase());
    for (const k of keys) {
      const kl = String(k || '').toLowerCase();
      if (lowerCandidates.some(c => kl === c || kl.includes(c) || c.includes(kl))) {
        const v = indexMap[k]; if (Number.isFinite(v)) return v;
      }
    }
    return -1;
  }

  // expose helpers
  window.updateHelpers = window.updateHelpers || {};
  window.updateHelpers.colToA1 = colToA1;
  window.updateHelpers.loadIndexMap = loadIndexMap;
  window.updateHelpers.findInIndexMap = findInIndexMap;
})();
