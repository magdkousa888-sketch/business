// bundle-ui-update.js — Efficient update and sync helpers for Bundle Manager
(function(){
  'use strict';

  // =====================================================================
  // CONFIGURATION & CONSTANTS
  // =====================================================================
  
  const SPREADSHEET_ID = () => window.GOOGLE_SPREADSHEET_ID || '17gh8MZSeFVPQudyTGwYf5_pFWH8yt-xpCPiPy9i8x-U';
  const SHEET_NAME = () => window.BUNDLES_SHEET_NAME || 'Bundles';
  const RANGE = () => `${SHEET_NAME()}!A1:Z`;

  // =====================================================================
  // UTILITIES
  // =====================================================================

  /**
   * Loads sheet data from Google Sheets
   */
  async function _loadSheetData() {
    if (window.ServiceAccountAuth && typeof window.ServiceAccountAuth.fetch === 'function') {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID()}/values/${RANGE()}`;
      const response = await window.ServiceAccountAuth.fetch(url);
      if (!response.ok) throw new Error(`Failed to load sheet data (${response.status})`);
      const json = await response.json();
      return json.values || [];
    } else if (window.googleSheetsClient && typeof window.googleSheetsClient.loadRange === 'function') {
      return await window.googleSheetsClient.loadRange(RANGE());
    }
    throw new Error('No Google Sheets client available');
  }

  /**
   * Gets sheet metadata (sheetId) for batch operations
   */
  async function _getSheetMetadata() {
    if (window.ServiceAccountAuth && typeof window.ServiceAccountAuth.fetch === 'function') {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID()}?fields=sheets(properties)`;
      const response = await window.ServiceAccountAuth.fetch(url);
      if (!response.ok) return null;
      const json = await response.json();
      const sheet = json.sheets?.find(s => s.properties?.title === SHEET_NAME());
      return sheet ? { sheetId: sheet.properties.sheetId } : null;
    }
    return null;
  }

  /**
   * Builds column map from header row
   */
  function _buildColumnMap(headerRow) {
    const colMap = {};
    headerRow.forEach((col, idx) => {
      const normalized = String(col || '').trim().toLowerCase();
      colMap[normalized] = idx;
    });
    return colMap;
  }

  /**
   * Finds all rows matching a bundle ID
   */
  function _findBundleRows(sheetData, bundleIdCol, bundleId) {
    const bundleIdNorm = String(bundleId || '').trim().toLowerCase();
    const matchingRows = [];
    
    for (let i = 1; i < sheetData.length; i++) {
      const row = sheetData[i];
      const cellValue = String(row[bundleIdCol] || '').trim().toLowerCase();
      if (cellValue === bundleIdNorm) {
        matchingRows.push({ index: i, rowNumber: i + 1, data: row });
      }
    }
    
    return matchingRows;
  }

  /**
   * Gets current bundle from manager
   */
  function _getCurrentBundle() {
    const curIdx = window._bundleManagerGlobal?.getCurrentBundleIndex?.() ?? null;
    if (curIdx === null) return null;

    const bundles = window.bundleModel?.getBundles?.() ?? window.bundlesData ?? [];
    return bundles[curIdx] || null;
  }

  /**
   * Gets current items from UI form
   */
  function _getUIItems() {
    const tbody = document.getElementById('bundleItemsBody');
    if (!tbody) return [];

    const tableRows = Array.from(tbody.querySelectorAll('tr'));
    return tableRows.map(tr => ({
      name: tr.querySelector('.bundle-item-name')?.value.trim() || '',
      qty: parseFloat(tr.querySelector('.bundle-item-qty')?.value) || 0,
      price: parseFloat(tr.querySelector('.bundle-item-price')?.value) || 0,
      taxable: tr.querySelector('.bundle-item-taxable')?.value || 'Standard'
    })).filter(item => item.name);
  }

  /**
   * Gets current bundle metadata from UI form
   */
  function _getUIBundleData(currentBundle) {
    return {
      bundleName: document.getElementById('bundleName')?.value.trim() || '',
      bundleExpiry: document.getElementById('bundleExpiry')?.value || '',
      textBefore: document.getElementById('bundleTextBefore')?.value.trim() || '',
      defendant: document.getElementById('bundleDefendant')?.value.trim() || '',
      textAfter: document.getElementById('bundleTextAfter')?.value.trim() || '',
      clientName: document.getElementById('bundleClientName')?.value.trim() || '',
      notes: document.getElementById('bundleNotes')?.value.trim() || '',
      'Created Date': currentBundle?.['Created Date'] || currentBundle?.createdDate || '',
      'Create Date': currentBundle?.['Create Date'] || currentBundle?.['Created Date'] || currentBundle?.createdDate || '',
      createdDate: currentBundle?.createdDate || ''
    };
  }

  /**
   * Builds field mapping for a row
   */
  function _buildFieldMap(bundleId, bundleData, item = null) {
    const map = {
      'bundle id': bundleId,
      'bundleid': bundleId,
      'bundle name': bundleData.bundleName,
      'bundlename': bundleData.bundleName,
      'bundle expiry': bundleData.bundleExpiry,
      'bundleexpiry': bundleData.bundleExpiry,
      'text before': bundleData.textBefore,
      'textbefore': bundleData.textBefore,
      'defendant': bundleData.defendant,
      'text after': bundleData.textAfter,
      'textafter': bundleData.textAfter,
      'client name': bundleData.clientName,
      'clientname': bundleData.clientName,
      'notes': bundleData.notes,
      'created date': bundleData['Created Date'],
      'createddate': bundleData['Created Date'],
      'create date': bundleData['Create Date'],
      'createdate': bundleData['Create Date']
    };

    if (item) {
      map['bundle item'] = item.name;
      map['bundleitem'] = item.name;
      map['item quantity'] = item.qty;
      map['itemquantity'] = item.qty;
      map['item price'] = item.price;
      map['itemprice'] = item.price;
      map['taxable'] = item.taxable || 'Standard';
    }

    return map;
  }

  /**
   * Builds a row array from field map based on headers
   */
  function _buildRowFromFieldMap(headerRow, fieldMap, existingRow = null) {
    const row = existingRow ? [...existingRow] : new Array(headerRow.length).fill('');
    
    headerRow.forEach((col, idx) => {
      const normalized = String(col || '').trim().toLowerCase();
      if (fieldMap.hasOwnProperty(normalized)) {
        row[idx] = String(fieldMap[normalized]);
      }
    });
    
    return row;
  }

  /**
   * Compares two items for equality
   */
  function _itemsEqual(a, b) {
    return a.name.toLowerCase() === b.name.toLowerCase() &&
           a.qty === b.qty &&
           a.price === b.price &&
           (a.taxable || 'Standard') === (b.taxable || 'Standard');
  }

  /**
   * Performs batch update on Google Sheets
   */
  async function _batchUpdateRows(updates) {
    const batchUpdateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID()}/values:batchUpdate`;
    const batchRequest = {
      valueInputOption: 'USER_ENTERED',
      data: updates
    };

    const response = await window.ServiceAccountAuth.fetch(batchUpdateUrl, {
      method: 'POST',
      body: JSON.stringify(batchRequest)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to batch update (${response.status})`);
    }
  }

  // =====================================================================
  // CORE OPERATIONS
  // =====================================================================

  /**
   * Deletes a bundle item row from Google Sheets
   */
  async function deleteBundleItemRowFromGoogleSheets(bundleId, itemName, options = {}) {
    try {
      const { occurrence = 0, deleteRow = true, qty = null, price = null } = options;
      
      if (!bundleId || !itemName) throw new Error('Invalid bundleId or itemName');

      const sheetData = await _loadSheetData();
      if (!sheetData || sheetData.length < 2) throw new Error('Sheet has no data');

      const colMap = _buildColumnMap(sheetData[0]);
      const bundleIdCol = colMap['bundle id'] ?? colMap['bundleid'];
      const itemNameCol = colMap['bundle item'] ?? colMap['bundleitem'];
      const qtyCol = colMap['item quantity'] ?? colMap['itemquantity'];
      const priceCol = colMap['item price'] ?? colMap['itemprice'];

      if (bundleIdCol === undefined || itemNameCol === undefined) {
        throw new Error('Required columns not found');
      }

      // Find matching rows
      const bundleIdNorm = String(bundleId).trim().toLowerCase();
      const itemNameNorm = String(itemName).trim().toLowerCase();
      const matchingIndices = [];

      for (let i = 1; i < sheetData.length; i++) {
        const row = sheetData[i];
        const cellBundleId = String(row[bundleIdCol] || '').trim().toLowerCase();
        const cellItemName = String(row[itemNameCol] || '').trim().toLowerCase();
        
        if (cellBundleId === bundleIdNorm && cellItemName === itemNameNorm) {
          if (qty !== null && qtyCol !== undefined && Number(row[qtyCol] || 0) !== Number(qty)) continue;
          if (price !== null && priceCol !== undefined && Number(row[priceCol] || 0) !== Number(price)) continue;
          matchingIndices.push(i);
        }
      }

      if (matchingIndices.length === 0) {
        console.warn(`No matching row found for bundle "${bundleId}", item "${itemName}"`);
        return { ok: true, rowDeleted: 0 };
      }

      const targetIndex = occurrence < matchingIndices.length ? matchingIndices[occurrence] : matchingIndices[0];

      // Delete using batchUpdate API
      if (deleteRow && window.ServiceAccountAuth) {
        const sheetMetadata = await _getSheetMetadata();
        if (!sheetMetadata) throw new Error('Could not get sheet metadata');

        const batchUpdateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID()}:batchUpdate`;
        const deleteRequest = {
          requests: [{
            deleteDimension: {
              range: {
                sheetId: sheetMetadata.sheetId,
                dimension: 'ROWS',
                startIndex: targetIndex,
                endIndex: targetIndex + 1
              }
            }
          }]
        };

        const response = await window.ServiceAccountAuth.fetch(batchUpdateUrl, {
          method: 'POST',
          body: JSON.stringify(deleteRequest)
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error?.message || `Failed to delete row (${response.status})`);
        }

        console.log(`✓ Deleted row ${targetIndex + 1}`);
        return { ok: true, rowDeleted: targetIndex + 1 };
      }

      return { ok: true, rowDeleted: 0 };

    } catch (err) {
      console.error('deleteBundleItemRowFromGoogleSheets error:', err);
      return { ok: false, error: err };
    }
  }

  /**
   * Appends a new item row to a bundle in Google Sheets
   */
  async function appendBundleItemToGoogleSheets(bundleId, item, bundleData) {
    try {
      if (!bundleId || !item?.name) throw new Error('Invalid bundleId or item');

      const sheetData = await _loadSheetData();
      if (!sheetData || sheetData.length < 2) throw new Error('Sheet has no data');

      const headerRow = sheetData[0];
      const colMap = _buildColumnMap(headerRow);
      const bundleIdCol = colMap['bundle id'] ?? colMap['bundleid'];

      if (bundleIdCol === undefined) throw new Error('Column "Bundle ID" not found');

      // Find last row of bundle
      const bundleRows = _findBundleRows(sheetData, bundleIdCol, bundleId);
      if (bundleRows.length === 0) throw new Error(`Bundle "${bundleId}" not found`);

      const lastRowIndex = bundleRows[bundleRows.length - 1].index;
      const insertRowNumber = lastRowIndex + 2;

      // Build new row
      const fieldMap = _buildFieldMap(bundleId, bundleData, item);
      const newRow = _buildRowFromFieldMap(headerRow, fieldMap);

      // Insert row using batchUpdate
      if (window.ServiceAccountAuth) {
        const sheetMetadata = await _getSheetMetadata();
        if (!sheetMetadata) throw new Error('Could not get sheet metadata');

        const batchUpdateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID()}:batchUpdate`;
        
        // Insert blank row
        let insertRequest = {
          requests: [{
            insertDimension: {
              range: {
                sheetId: sheetMetadata.sheetId,
                dimension: 'ROWS',
                startIndex: insertRowNumber - 1,
                endIndex: insertRowNumber
              }
            }
          }]
        };

        let response = await window.ServiceAccountAuth.fetch(batchUpdateUrl, {
          method: 'POST',
          body: JSON.stringify(insertRequest)
        });

        if (!response.ok) throw new Error('Failed to insert row');

        // Update row with data
        const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID()}/values/${SHEET_NAME()}!A${insertRowNumber}?valueInputOption=USER_ENTERED`;
        
        response = await window.ServiceAccountAuth.fetch(updateUrl, {
          method: 'PUT',
          body: JSON.stringify({ values: [newRow] })
        });

        if (!response.ok) throw new Error('Failed to update row');

        console.log(`✓ Added item to row ${insertRowNumber}`);
        return { ok: true, rowNumber: insertRowNumber };
      }

      throw new Error('No method available to insert row');

    } catch (err) {
      console.error('appendBundleItemToGoogleSheets error:', err);
      return { ok: false, error: err };
    }
  }

  /**
   * Updates bundle metadata for all bundle rows in Google Sheets
   */
  async function updateBundleMetadataInGoogleSheets(bundleId, bundleData) {
    try {
      if (!bundleId) throw new Error('Invalid bundleId');

      const sheetData = await _loadSheetData();
      if (!sheetData || sheetData.length < 2) throw new Error('Sheet has no data');

      const headerRow = sheetData[0];
      const colMap = _buildColumnMap(headerRow);
      const bundleIdCol = colMap['bundle id'] ?? colMap['bundleid'];

      if (bundleIdCol === undefined) throw new Error('Column "Bundle ID" not found');

      // Find all bundle rows
      const bundleRows = _findBundleRows(sheetData, bundleIdCol, bundleId);
      if (bundleRows.length === 0) {
        console.warn(`No rows found for bundle "${bundleId}"`);
        return { ok: true, rowsUpdated: 0 };
      }

      // Build metadata field map (no item fields)
      const fieldMap = _buildFieldMap(bundleId, bundleData);

      // Build updates for each row
      const updates = bundleRows.map(bundleRow => ({
        range: `${SHEET_NAME()}!A${bundleRow.rowNumber}`,
        values: [_buildRowFromFieldMap(headerRow, fieldMap, bundleRow.data)]
      }));

      // Batch update
      if (window.ServiceAccountAuth) {
        await _batchUpdateRows(updates);
        console.log(`✓ Updated metadata for ${updates.length} row(s)`);
        return { ok: true, rowsUpdated: updates.length };
      }

      throw new Error('No method available to batch update');

    } catch (err) {
      console.error('updateBundleMetadataInGoogleSheets error:', err);
      return { ok: false, error: err };
    }
  }

  /**
   * Main sync function: syncs all bundle changes to Google Sheets
   */
  async function syncBundleItemsOnUpdate() {
    try {
      console.log('=== SYNCING BUNDLE ===');

      const currentBundle = _getCurrentBundle();
      if (!currentBundle) {
        console.log('No bundle selected (create mode)');
        return { ok: true, created: true };
      }

      const bundleId = currentBundle.id;
      if (!bundleId) {
        console.warn('Bundle has no ID');
        return { ok: false, error: 'No bundle ID' };
      }

      // Get current state from UI
      const currentBundleData = _getUIBundleData(currentBundle);
      const currentItems = _getUIItems();
      const previousItems = Array.isArray(currentBundle.items) ? currentBundle.items : [];

      console.log('Previous items:', previousItems.length);
      console.log('Current items:', currentItems.length);

      // Check metadata changes
      const metadataChanged = 
        currentBundleData.bundleName !== (currentBundle.bundleName || '') ||
        currentBundleData.bundleExpiry !== (currentBundle.bundleExpiry || '') ||
        currentBundleData.textBefore !== (currentBundle.textBefore || '') ||
        currentBundleData.defendant !== (currentBundle.defendant || '') ||
        currentBundleData.textAfter !== (currentBundle.textAfter || '') ||
        currentBundleData.clientName !== (currentBundle.clientName || '') ||
        currentBundleData.notes !== (currentBundle.notes || '');

      // Load sheet data once for all operations
      const sheetData = await _loadSheetData();
      if (!sheetData || sheetData.length < 2) throw new Error('Sheet has no data');

      const headerRow = sheetData[0];
      const colMap = _buildColumnMap(headerRow);
      const bundleIdCol = colMap['bundle id'] ?? colMap['bundleid'];
      if (bundleIdCol === undefined) throw new Error('Column "Bundle ID" not found');

      const bundleRows = _findBundleRows(sheetData, bundleIdCol, bundleId);
      if (bundleRows.length === 0) throw new Error(`Bundle "${bundleId}" not found in sheet`);

      // Map previous items to their sheet rows
      const itemToRowMap = new Map();
      bundleRows.forEach((row, idx) => {
        if (idx < previousItems.length) {
          itemToRowMap.set(idx, row);
        }
      });

      // Categorize changes
      const updates = [];
      const deletions = [];
      const additions = [];

      // Check each current item
      currentItems.forEach((currentItem, currentIdx) => {
        if (currentIdx < previousItems.length) {
          const prevItem = previousItems[currentIdx];
          if (!_itemsEqual(currentItem, prevItem)) {
            // Item at this position was modified - update in place
            updates.push({ index: currentIdx, item: currentItem, row: itemToRowMap.get(currentIdx) });
          }
        } else {
          // New item beyond previous count - needs to be added
          additions.push(currentItem);
        }
      });

      // Check for deleted items (current has fewer items than previous)
      if (currentItems.length < previousItems.length) {
        for (let i = currentItems.length; i < previousItems.length; i++) {
          deletions.push({ index: i, item: previousItems[i], row: itemToRowMap.get(i) });
        }
      }

      console.log(`Changes: metadata=${metadataChanged}, updates=${updates.length}, deletions=${deletions.length}, additions=${additions.length}`);

      // Execute metadata updates
      if (metadataChanged) {
        console.log('Updating bundle metadata...');
        await updateBundleMetadataInGoogleSheets(bundleId, currentBundleData);
      }

      // Execute item updates in place
      if (updates.length > 0) {
        console.log(`Updating ${updates.length} item(s) in place...`);
        const batchUpdates = [];
        
        for (const update of updates) {
          const fieldMap = _buildFieldMap(bundleId, currentBundleData, update.item);
          const updatedRow = _buildRowFromFieldMap(headerRow, fieldMap);
          const rowNumber = update.row.rowNumber;
          
          batchUpdates.push({
            range: `${SHEET_NAME()}!A${rowNumber}`,
            values: [updatedRow]
          });
        }

        if (batchUpdates.length > 0) {
          await _batchUpdateRows(batchUpdates);
        }
        console.log('✓ Items updated');
      }

      // Execute deletions (from bottom to top to preserve indices)
      if (deletions.length > 0) {
        console.log(`Deleting ${deletions.length} item(s)...`);
        deletions.sort((a, b) => b.index - a.index); // Delete from bottom up
        
        for (const deletion of deletions) {
          await deleteBundleItemRowFromGoogleSheets(bundleId, deletion.item.name, {
            occurrence: 0,
            deleteRow: true,
            qty: deletion.item.qty,
            price: deletion.item.price
          });
        }
        console.log('✓ Items deleted');
      }

      // Execute additions
      if (additions.length > 0) {
        console.log(`Adding ${additions.length} new item(s)...`);
        for (const item of additions) {
          await appendBundleItemToGoogleSheets(bundleId, item, currentBundleData);
        }
        console.log('✓ Items added');
      }

      // Refresh bundle data
      if (typeof window.loadBundlesFromGoogleSheets === 'function') {
        await window.loadBundlesFromGoogleSheets();
      }

      console.log('=== SYNC COMPLETE ===');
      return { ok: true, updatedCount: updates.length, deletedCount: deletions.length, addedCount: additions.length };

    } catch (err) {
      console.error('syncBundleItemsOnUpdate error:', err);
      return { ok: false, error: err };
    }
  }

  /**
   * TESTER: Compares bundle items in UI with Google Sheets
   */
  async function testBundleItemsMatchWithSheet() {
    try {
      console.log('=== BUNDLE ITEMS TESTER ===');

      const currentBundle = _getCurrentBundle();
      if (!currentBundle?.id) {
        console.warn('No bundle selected or bundle has no ID');
        return;
      }

      console.log('Bundle:', currentBundle.bundleName, `(${currentBundle.id})`);

      const htmlItems = _getUIItems();
      console.log(`\nHTML items (${htmlItems.length}):`);
      console.table(htmlItems);

      const sheetData = await _loadSheetData();
      if (!sheetData || sheetData.length < 2) {
        console.warn('Sheet has no data');
        return;
      }

      const colMap = _buildColumnMap(sheetData[0]);
      const bundleRows = _findBundleRows(sheetData, colMap['bundle id'] ?? colMap['bundleid'], currentBundle.id);

      const sheetItems = bundleRows.map(r => ({
        rowNumber: r.rowNumber,
        name: r.data[colMap['bundle item'] ?? colMap['bundleitem']] || '',
        qty: parseFloat(r.data[colMap['item quantity'] ?? colMap['itemquantity']]) || 0,
        price: parseFloat(r.data[colMap['item price'] ?? colMap['itemprice']]) || 0
      }));

      console.log(`\nSheet items (${sheetItems.length}):`);
      console.table(sheetItems);

      // Comparison
      console.log('\n=== COMPARISON ===');
      htmlItems.forEach((html, idx) => {
        const match = sheetItems.find(s => s.name.toLowerCase() === html.name.toLowerCase());
        if (match) {
          const differs = html.qty !== match.qty || html.price !== match.price;
          console.log(`${differs ? '⚠️' : '✓'} HTML[${idx}] matches Sheet[${match.rowNumber}]:`, html.name);
        } else {
          console.log(`✗ HTML[${idx}] NOT in sheet:`, html.name);
        }
      });

      sheetItems.forEach(sheet => {
        const match = htmlItems.find(h => h.name.toLowerCase() === sheet.name.toLowerCase());
        if (!match) {
          console.log(`✗ Sheet[${sheet.rowNumber}] NOT in HTML:`, sheet.name);
        }
      });

      console.log('=== END TESTER ===');
      return { htmlItems, sheetItems };

    } catch (err) {
      console.error('testBundleItemsMatchWithSheet error:', err);
    }
  }

  // =====================================================================
  // EXPORTS
  // =====================================================================

  window.testBundleItemsMatchWithSheet = testBundleItemsMatchWithSheet;
  window.deleteBundleItemRowFromGoogleSheets = deleteBundleItemRowFromGoogleSheets;
  window.appendBundleItemToGoogleSheets = appendBundleItemToGoogleSheets;
  window.updateBundleMetadataInGoogleSheets = updateBundleMetadataInGoogleSheets;
  window.syncBundleItemsOnUpdate = syncBundleItemsOnUpdate;

  console.log('bundle-ui-update: ready (efficient version)');
})();
