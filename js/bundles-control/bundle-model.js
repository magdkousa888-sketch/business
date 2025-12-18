// bundle-model.js — data model and persistence for bundles
(function(){
  'use strict';

  function loadFromLocalStorage() {
    try {
      const raw = localStorage.getItem('invoiceApp_bundles');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      window.bundlesData = parsed;
      return parsed;
    } catch (e) {
      console.warn('bundle-model: failed to load from localStorage', e);
      return [];
    }
  }

  function saveToLocalStorage() {
    try {
      localStorage.setItem('invoiceApp_bundles', JSON.stringify(window.bundlesData || []));
    } catch (e) {
      console.warn('bundle-model: failed to persist bundles', e);
    }
  }

  function getBundles() {
    window.bundlesData = window.bundlesData || [];
    return window.bundlesData;
  }

  function setBundles(arr) {
    window.bundlesData = Array.isArray(arr) ? arr : [];
    saveToLocalStorage();
    return window.bundlesData;
  }

  function addBundle(bundle) {
    if (!bundle) return null;
    window.bundlesData = window.bundlesData || [];
    window.bundlesData.push(bundle);
    saveToLocalStorage();
    return bundle;
  }

  function updateBundle(index, bundle) {
    if (!Array.isArray(window.bundlesData)) return null;
    if (index == null || index < 0 || index >= window.bundlesData.length) return null;
    window.bundlesData[index] = bundle;
    saveToLocalStorage();
    return bundle;
  }

  function deleteBundle(index) {
    if (!Array.isArray(window.bundlesData)) return null;
    if (index == null || index < 0 || index >= window.bundlesData.length) return null;
    const removed = window.bundlesData.splice(index, 1);
    saveToLocalStorage();
    return removed && removed[0] ? removed[0] : null;
  }

  function findLastIndex() {
    const arr = window.bundlesData || [];
    return arr.length - 1;
  }

  // Init from localStorage if no data yet
  if (!Array.isArray(window.bundlesData) || window.bundlesData.length === 0) {
    loadFromLocalStorage();
  }

  window.bundleModel = {
    loadFromLocalStorage,
    saveToLocalStorage,
    getBundles,
    setBundles,
    addBundle,
    updateBundle,
    deleteBundle,
    findLastIndex
  };

  console.log('bundle-model: ready');
})();
