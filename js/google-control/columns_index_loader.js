// columns_index_loader.js
// Client-side loader for the "Columns Index" sheet.
// Reads ranges (preferred: A1:C500), filters rows whose first column matches the dataset (e.g. 'Invoices'),
// and saves a validated mapping of { columnName: index | null } to window.columnsIndexCache and localStorage.
(function () {
    'use strict';

    // initialize cache container
    window.columnsIndexCache = window.columnsIndexCache || {};

    // Persist helpers
    function persist(dataset, mapping) {
        try {
            window.columnsIndexCache[dataset] = mapping || {};
            localStorage.setItem(`columnsIndex:${dataset}`, JSON.stringify(mapping || {}));
        } catch (e) {
            console.warn('columns_index_loader: failed to persist mapping', e);
        }
    }

    function loadPersisted(dataset) {
        try {
            const raw = localStorage.getItem(`columnsIndex:${dataset}`);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) {
            return null;
        }
    }

    // UI status helpers — update the visible badge if present
    function getStatusEl() {
        if (typeof document === 'undefined') return null;
        return document.getElementById('columnsIndexStatus');
    }

    function setColumnsIndexStatus(message, kind = 'info') {
        const el = getStatusEl();
        if (!el) return;
        try {
            // Keep the UI minimal — only show details for error states.
            if ((kind || '').toLowerCase() === 'error') {
                el.textContent = `Columns Index: ${message}`;
            } else {
                // Non-error states (success/info/warning) show a minimal label only
                el.textContent = `Columns Index`;
            }
            // Basic styles per kind
            switch ((kind || '').toLowerCase()) {
                case 'success':
                    el.style.background = '#dcfce7';
                    el.style.color = '#064e3b';
                    el.style.border = '1px solid #bbf7d0';
                    break;
                case 'warning':
                    el.style.background = '#fff7ed';
                    el.style.color = '#92400e';
                    el.style.border = '1px solid #fcd34d';
                    break;
                case 'error':
                    el.style.background = '#fee2e2';
                    el.style.color = '#7f1d1d';
                    el.style.border = '1px solid #fecaca';
                    break;
                default:
                    el.style.background = '#f3f4f6';
                    el.style.color = '#374151';
                    el.style.border = '1px solid transparent';
            }
        } catch (e) { /* ignore DOM errors */ }
    }

    // validation: numeric ints >= 0 and no duplicate indexes
    // Returns an object { validated: {key: number|null}, invalid: [{key, reason}] }
    function validateMapping(map) {
        const result = { validated: {}, invalid: [] };
        if (!map || typeof map !== 'object') return result;
        const used = new Map();
        const MAX_INDEX = 2000;

        Object.keys(map).forEach(k => {
            const v = map[k];
            if (v === null || v === '' || v === undefined) {
                // retired column — keep as null
                result.validated[k] = null;
                return;
            }
            const n = parseInt(v, 10);
            if (isNaN(n)) {
                result.invalid.push({ key: k, reason: 'non-numeric index' });
                return;
            }
            if (n < 0 || n > MAX_INDEX) {
                result.invalid.push({ key: k, reason: `index out of range (${n})` });
                return;
            }
            if (used.has(n) && used.get(n) !== k) {
                result.invalid.push({ key: k, reason: `duplicate index (${n})` });
                return;
            }
            used.set(n, k);
            result.validated[k] = n;
        });

        return result;
    }

    // Parse a values array (Google Sheets result) into mapping for the dataset.
    // values: Array<Array> rows. datasetFilter: string to match in first column
    function parseValuesToMapping(values, datasetFilter) {
        if (!Array.isArray(values) || values.length === 0) return {};
        // Determine header row heuristics
        const headerRow = values[0].map(h => String(h || '').trim().toLowerCase());
        const hasData = headerRow.some(h => /^(data|dataset)$/i.test(h));
        const hasColumn = headerRow.some(h => /^(column|header|column name)$/i.test(h));
        const hasIndex = headerRow.some(h => /(index|column index|col index|idx)/i.test(h));

        const out = {};

        // If header looks like Data / Column / Column Index, use keys
        const start = hasData || hasColumn || hasIndex ? 1 : 0; // if headers exist, skip first row

        for (let i = start; i < values.length; i++) {
            const row = values[i];
            if (!row || row.length === 0) continue;

            // Map cells by position
            const a = (row[0] !== undefined) ? String(row[0]).trim() : '';
            const b = (row[1] !== undefined) ? String(row[1]).trim() : '';
            const c = (row[2] !== undefined) ? String(row[2]).trim() : '';

            // If row format is Data, Column, Index (3 columns)
            if (row.length >= 3) {
                if (String(a).toLowerCase() === String(datasetFilter).toLowerCase()) {
                    out[b] = (c === '' ? null : (isNaN(parseInt(c, 10)) ? null : parseInt(c, 10)));
                }
            } else if (row.length === 2) {
                // Ambiguous: If 'a' equals dataset (Invoices) and b is index OR column name
                // We'll interpret as Data,Column (no index) if first col equals dataset and second is string.
                // If headers are absent and first column is column name and second a number, treat as column->index
                if (String(a).toLowerCase() === String(datasetFilter).toLowerCase()) {
                    // Data,Column (no index)
                    out[b] = null;
                } else {
                    // Could be Column,Index
                    const n = parseInt(b, 10);
                    if (!isNaN(n)) {
                        out[a] = n;
                    } else {
                        // fallback treat as Column->null
                        out[a] = null;
                    }
                }
            } else if (row.length === 1) {
                // Only one column — nothing we can use reliably
                continue;
            }
        }

        return out;
    }

    // Parse CSV text as fallback (simple parsing)
    function parseCsvText(text, datasetFilter) {
        if (!text) return {};
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const out = {};
        // Skip header if appears
        const header = lines.length > 0 ? lines[0].split(/,|\t/) : [];
        let startIndex = 0;
        if (header.length >= 2 && /data|column/i.test(header[0]) ) startIndex = 1;

        for (let i = startIndex; i < lines.length; i++) {
            const parts = lines[i].split(',').map(p => p.trim());
            if (parts.length >= 3) {
                const data = parts[0];
                const col = parts[1];
                const idx = parts[2];
                if (String(data).toLowerCase() === String(datasetFilter).toLowerCase()) {
                    out[col] = (idx === '' ? null : (isNaN(parseInt(idx, 10)) ? null : parseInt(idx, 10)));
                }
            } else if (parts.length === 2) {
                // Could be Column, Index OR Data, Column
                const a = parts[0];
                const b = parts[1];
                if (String(a).toLowerCase() === String(datasetFilter).toLowerCase()) {
                    out[b] = null;
                } else if (!isNaN(parseInt(b, 10))) {
                    out[a] = parseInt(b, 10);
                } else {
                    out[a] = null;
                }
            }
        }

        return out;
    }

    // Main loader: attempts googleSheetsClient.loadRange first, then falls back to local CSV
    async function loadColumnsIndexFromSheet(dataset = 'Invoices', opts = {}) {
        const force = !!opts.force;
        const rangeCandidates = opts.ranges || ['Columns Index!A1:C500', 'Columns Index!A1:B500'];

        if (!force && window.columnsIndexCache && window.columnsIndexCache[dataset]) {
            try { console.log(`✅ Columns Index mapping loaded from cache for ${dataset} — ${Object.keys(window.columnsIndexCache[dataset]).length} keys`); } catch (e) {}
            // Show a concise success message in the UI (do not show key-count details or ranges in the UI)
            setColumnsIndexStatus(`Loaded`, 'success');
            return window.columnsIndexCache[dataset];
        }

        // Try google_sheets_client if available
        if (window.googleSheetsClient && typeof window.googleSheetsClient.loadRange === 'function') {
            for (const r of rangeCandidates) {
                try {
                    const resp = await window.googleSheetsClient.loadRange(r);
                    const values = (resp && Array.isArray(resp.values)) ? resp.values : [];
                    const mapping = parseValuesToMapping(values, dataset);
                    const validation = validateMapping(mapping);
                    const validated = validation.validated || {};
                    const invalid = validation.invalid || [];
                    if (Object.keys(validated).length > 0) {
                        persist(dataset, validated);
                        try { console.log(`✅ Columns Index mapping loaded from sheets range ${r} for ${dataset} — ${Object.keys(validated).length} valid keys${invalid.length ? ', ' + invalid.length + ' invalid' : ''}`); } catch (e) {}
                        if (invalid.length > 0) {
                            // Log detailed counts to console so developers can inspect counts; keep UI message concise
                            try { console.log(`Columns Index mapping partially loaded for ${dataset}: ${Object.keys(validated).length} valid · ${invalid.length} invalid`); } catch (e) {}
                            setColumnsIndexStatus(`Partial mapping loaded`, 'warning');
                            try { console.warn('columns_index_loader: some mapping rows failed validation', invalid); } catch (e) {}
                        } else {
                            // Hide numeric key counts from the UI; log full detail to console
                            try { console.log(`✅ Columns Index mapping loaded from sheets range ${r} for ${dataset} — ${Object.keys(validated).length} valid keys${invalid.length ? ', ' + invalid.length + ' invalid' : ''}`); } catch (e) {}
                            // Keep UI message concise: show 'Loaded' only (details logged to console)
                            setColumnsIndexStatus(`Loaded`, 'success');
                        }
                        return validated;
                    } else if (invalid.length > 0) {
                        try { console.warn('columns_index_loader: parsed mapping from sheets but no valid rows', invalid); } catch (e) {}
                        setColumnsIndexStatus('No valid rows in sheet mapping', 'error');
                    }
                    // If mapping present (even with retired entries) but validation failed, continue to next candidate
                } catch (e) {
                    // keep trying other ranges
                }
            }
        }

        // Fallback: try ServiceAccountAuth (preferred) then local CSV at /Columns index.csv using the dataset filter
        // This ensures we fetch the live Columns Index from the sheet when a service account is configured.
        try {
            // If a client-side service account helper is available, prefer using it to load the range
            if (window.ServiceAccountAuth && typeof window.ServiceAccountAuth.fetch === 'function') {
                for (const r of rangeCandidates) {
                    try {
                        const SPREADSHEET_ID = window.GOOGLE_SPREADSHEET_ID || '17gh8MZSeFVPQudyTGwYf5_pFWH8yt-xpCPiPy9i8x-U';
                        const encodedRange = encodeURIComponent(r);
                        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodedRange}`;
                        const resp = await window.ServiceAccountAuth.fetch(url, { method: 'GET' });
                        if (!resp.ok) continue;
                        const body = await resp.json().catch(() => null);
                        const values = (body && Array.isArray(body.values)) ? body.values : [];
                        const mapping = parseValuesToMapping(values, dataset);
                        const validation = validateMapping(mapping);
                        const validated = validation.validated || {};
                        const invalid = validation.invalid || [];
                        if (Object.keys(validated).length > 0) {
                            persist(dataset, validated);
                            try { console.log(`✅ Columns Index mapping loaded from sheets API range ${r} for ${dataset} — ${Object.keys(validated).length} valid keys${invalid.length ? ', ' + invalid.length + ' invalid' : ''}`); } catch (e) {}
                            if (invalid.length > 0) {
                                try { console.log(`Columns Index mapping partially loaded for ${dataset}: ${Object.keys(validated).length} valid · ${invalid.length} invalid`); } catch (e) {}
                                setColumnsIndexStatus(`Partial mapping loaded`, 'warning');
                                try { console.warn('columns_index_loader: some mapping rows failed validation', invalid); } catch (e) {}
                            } else {
                                try { console.log(`✅ Columns Index mapping loaded from sheets range ${r} for ${dataset} — ${Object.keys(validated).length} valid keys${invalid.length ? ', ' + invalid.length + ' invalid' : ''}`); } catch (e) {}
                                // Keep UI message concise: show 'Loaded' only (details logged to console)
                                setColumnsIndexStatus(`Loaded`, 'success');
                            }
                            return validated;
                        }
                        // If mapping present (even with retired entries) but validation failed, continue to next candidate
                    } catch (e) {
                        // try next range
                    }
                }
            }
        } catch (e) {
            // ignore and fall back to CSV
        }

        // Fallback to local CSV
        try {
            const csvUrl = '/Columns index.csv';
            const r = await fetch(csvUrl, { cache: 'no-store' });
            if (r.ok) {
                const text = await r.text();
                const parsed = parseCsvText(text, dataset);
                const validation = validateMapping(parsed);
                const validated = validation.validated || {};
                const invalid = validation.invalid || [];
                if (Object.keys(validated).length > 0) {
                    persist(dataset, validated);
                    try { console.log(`✅ Columns Index mapping loaded from local CSV for ${dataset} — ${Object.keys(validated).length} valid keys${invalid.length ? ', ' + invalid.length + ' invalid' : ''}`); } catch (e) {}
                    if (invalid.length > 0) {
                        try { console.log(`Columns Index mapping partially loaded for ${dataset}: ${Object.keys(validated).length} valid · ${invalid.length} invalid`); } catch (e) {}
                        setColumnsIndexStatus(`Partial mapping loaded`, 'warning');
                        try { console.warn('columns_index_loader: some CSV mapping rows failed validation', invalid); } catch (e) {}
                    } else {
                        try { console.log(`✅ Columns Index mapping loaded from local CSV for ${dataset} — ${Object.keys(validated).length} valid keys${invalid.length ? ', ' + invalid.length + ' invalid' : ''}`); } catch (e) {}
                        // Keep UI message concise: show 'Loaded' only (details logged to console)
                        setColumnsIndexStatus(`Loaded`, 'success');
                    }
                    return validated;
                } else if (invalid.length > 0) {
                    setColumnsIndexStatus('No valid rows in CSV mapping', 'error');
                }
            }
        } catch (e) {
            // ignore
        }

        // nothing usable found -> store empty map
        persist(dataset, {});
        setColumnsIndexStatus('No valid Columns Index mapping found', 'error');
        return {};
    }

    function getColumnsIndexCached(dataset = 'Invoices') {
        return (window.columnsIndexCache && window.columnsIndexCache[dataset]) ? window.columnsIndexCache[dataset] : null;
    }

    // Export
    window.loadColumnsIndexFromSheet = loadColumnsIndexFromSheet;
    window.getColumnsIndexCached = getColumnsIndexCached;

    console.log('columns_index_loader: ready — call loadColumnsIndexFromSheet("Invoices") to fetch mapping');
    // initialize UI state
    try { setColumnsIndexStatus('unknown', 'info'); } catch (e) {}

})();
