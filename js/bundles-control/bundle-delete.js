// bundle-delete.js — Delete entire bundle from Google Sheets
(function(){
  'use strict';

  const SPREADSHEET_ID = () => window.GOOGLE_SPREADSHEET_ID || '17gh8MZSeFVPQudyTGwYf5_pFWH8yt-xpCPiPy9i8x-U';
  const SHEET_NAME = () => window.BUNDLES_SHEET_NAME || 'Bundles';
  const RANGE = () => `${SHEET_NAME()}!A1:Z`;

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

  function _buildColumnMap(headerRow) {
    const colMap = {};
    headerRow.forEach((col, idx) => {
      const normalized = String(col || '').trim().toLowerCase();
      colMap[normalized] = idx;
    });
    return colMap;
  }

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

  async function deleteBundleFromGoogleSheets(bundleId) {
    try {
      if (!bundleId) throw new Error('Invalid bundleId');

      const sheetData = await _loadSheetData();
      if (!sheetData || sheetData.length < 2) {
        return { ok: true, rowsDeleted: 0 };
      }

      const colMap = _buildColumnMap(sheetData[0]);
      const bundleIdCol = colMap['bundle id'] ?? colMap['bundleid'];

      if (bundleIdCol === undefined) {
        throw new Error('Bundle ID column not found');
      }

      const bundleRows = _findBundleRows(sheetData, bundleIdCol, bundleId);
      
      if (bundleRows.length === 0) {
        return { ok: true, rowsDeleted: 0 };
      }

      if (window.ServiceAccountAuth) {
        const sheetMetadata = await _getSheetMetadata();
        if (!sheetMetadata) throw new Error('Could not get sheet metadata');

        const sortedRows = bundleRows.sort((a, b) => b.index - a.index);
        
        const deleteRequests = sortedRows.map(row => ({
          deleteDimension: {
            range: {
              sheetId: sheetMetadata.sheetId,
              dimension: 'ROWS',
              startIndex: row.index,
              endIndex: row.index + 1
            }
          }
        }));

        const batchUpdateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID()}:batchUpdate`;
        const response = await window.ServiceAccountAuth.fetch(batchUpdateUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requests: deleteRequests })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to delete bundle rows: ${response.status} - ${errorText}`);
        }

        return { ok: true, rowsDeleted: bundleRows.length };
      } else {
        throw new Error('ServiceAccountAuth not available');
      }

    } catch (err) {
      console.error('deleteBundleFromGoogleSheets error:', err);
      throw err;
    }
  }

  window.deleteBundleFromGoogleSheets = deleteBundleFromGoogleSheets;

})();
