// session_logger.js — append session metadata to System Logs sheet when Google Sheets is accessible
(function(){
  'use strict';

  // Default config
  const LOG_SHEET_NAME = 'System Logs';
  // Added Activity column (human friendly action description) before Event
  const LOG_HEADER = ['Timestamp','IP','Browser','Device ID','Location','Session ID','App','Spreadsheet ID','Page URL','User Agent','Columns Index Summary','Activity','Event','Details'];
  const APP_VERSION = (function(){ try { return document.querySelector('head title') ? document.querySelector('head title').textContent : 'Invoice Control Panel'; } catch(e){ return 'Invoice Control Panel'; } })();

  // small helper to generate or reuse a session id
  function getOrCreateSessionId(){
    try {
      const key = 'session_logger_session_id';
      let id = sessionStorage.getItem(key);
      if (!id){ id = Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36); sessionStorage.setItem(key, id); }
      return id;
    } catch(e){ return 'session-'+Date.now(); }
  }

  // Build metadata object (async: resolves IP & geolocation)
  async function collectSessionMetadata(){
    const now = new Date();
    const timestamp = now.toISOString();
    const sessionId = getOrCreateSessionId();
    const userAgent = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
    const href = (typeof window !== 'undefined' && window.location) ? window.location.href : '';
    const spreadsheetId = (typeof window !== 'undefined' && window.GOOGLE_SPREADSHEET_ID) ? window.GOOGLE_SPREADSHEET_ID : '';
    const columnsIndexSummary = (function(){ try {
      if (!window.columnsIndexCache) return '';
      const keys = Object.keys(window.columnsIndexCache || {});
      const parts = keys.map(k => `${k}:${Object.keys(window.columnsIndexCache[k]||{}).length}`);
      return parts.join(' | ');
    } catch(e){ return ''; } })();

    // resolve additional pieces
    const deviceId = getOrCreateDeviceId();
    const ip = await getPublicIP().catch(()=>(''));
    const location = await getLocation().catch(()=>(''));
    const browser = parseBrowser(userAgent || '');

    return {
      timestamp,
      ip,
      browser,
      deviceId,
      location,
      sessionId,
      app: APP_VERSION,
      spreadsheetId,
      page: href,
      userAgent,
      columnsIndexSummary,
      activity: 'Startup',
      event: 'startup',
      details: ''
    };
  }

  // Convert object to array for Sheets append (we'll include a known header order)
  function metadataToRow(m){
    return [
      m.timestamp || '',
      m.ip || '',
      m.browser || '',
      m.deviceId || '',
      m.location || '',
      m.sessionId || '',
      m.app || '',
      m.spreadsheetId || '',
      m.page || '',
      m.userAgent || '',
      m.columnsIndexSummary || '',
      m.activity || '',
      m.event || '',
      (typeof m.details === 'string' ? m.details : (m.details ? JSON.stringify(m.details) : ''))
    ];
  }

  // helpers: IP, device & parsing
  async function getPublicIP(){
    try {
      const r = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
      if (!r.ok) return '';
      const j = await r.json().catch(()=>null);
      return j && j.ip ? String(j.ip) : '';
    } catch(e){ return ''; }
  }

  function getOrCreateDeviceId(){
    try {
      const key = 'session_logger_device_id';
      if (typeof localStorage === 'undefined') return 'device-' + Date.now();
      let id = localStorage.getItem(key);
      if (!id){ id = 'device-' + Math.random().toString(36).slice(2,8) + '-' + Date.now().toString(36); localStorage.setItem(key, id); }
      return id;
    } catch(e){ return 'device-'+Date.now(); }
  }

  function parseBrowser(ua){
    try {
      ua = String(ua || '');
      if (/chrome|chromium/i.test(ua) && !/edge/i.test(ua)){
        const m = ua.match(/Chrome\/(\d+\.\d+)/i); return 'Chrome ' + (m ? m[1] : '');
      }
      if (/firefox/i.test(ua)){
        const m = ua.match(/Firefox\/(\d+\.\d+)/i); return 'Firefox ' + (m ? m[1] : '');
      }
      if (/safari/i.test(ua) && !/chrome/i.test(ua)){
        const m = ua.match(/Version\/(\d+\.\d+)/i); return 'Safari ' + (m ? m[1] : '');
      }
      if (/edge|edg/i.test(ua)){
        const m = ua.match(/Edg\/(\d+\.\d+)/i); return 'Edge ' + (m ? m[1] : '');
      }
      return ua.split(' ')[0] || ua;
    } catch(e){ return ''; }
  }

  function getLocation(timeoutMs = 5000){
    return new Promise((resolve, reject) => {
      try {
        if (!navigator || !navigator.geolocation) return resolve('');
        let timed = false;
        const timer = setTimeout(()=>{ timed = true; resolve(''); }, timeoutMs);
        navigator.geolocation.getCurrentPosition(pos => {
          if (timed) return;
          clearTimeout(timer);
          try { resolve(`${pos.coords.latitude},${pos.coords.longitude}`); } catch(e){ resolve(''); }
        }, err => { if (!timed){ clearTimeout(timer); resolve(''); } }, { maximumAge: 1000*60, timeout: timeoutMs });
      } catch(e){ resolve(''); }
    });
  }

  // Attempt to append row to System Logs sheet using ServiceAccountAuth
  async function appendToSystemLogs(row){
    if (!Array.isArray(row)) return false;
    // If preview mode, skip actual append
    if (window.DEBUG_PREVIEW_APPEND === true){ console.log('session_logger: DEBUG_PREVIEW_APPEND enabled, skipping append', row); return true; }

    if (!window.ServiceAccountAuth || typeof window.ServiceAccountAuth.fetch !== 'function'){
      console.warn('session_logger: ServiceAccountAuth not available — cannot append system log');
      // store pending row so UI can flush later
      enqueuePendingRow(row);
      window.sessionLogger._lastResult = { ok: false, enqueued: true, reason: 'ServiceAccountAuth missing' };
      return false;
    }

    const SPREADSHEET_ID = window.GOOGLE_SPREADSHEET_ID || null;
    if (!SPREADSHEET_ID){ console.warn('session_logger: GOOGLE_SPREADSHEET_ID not set — skipping system log'); enqueuePendingRow(row); window.sessionLogger._lastResult = { ok: false, enqueued: true, reason: 'GOOGLE_SPREADSHEET_ID missing' }; return false; }
    console.log('session_logger: appendToSystemLogs will attempt append to', SPREADSHEET_ID, 'sheet:', LOG_SHEET_NAME);

    // Ensure the System Logs sheet exists and has a header
    try {
      const headerOk = await ensureSystemLogsHeader();
      if (!headerOk) { console.warn('session_logger: could not ensure System Logs header — skipping append'); enqueuePendingRow(row); window.sessionLogger._lastResult = { ok: false, enqueued: true, reason: 'Header ensure failed' }; return false; }
    } catch(e){ console.warn('session_logger: header check threw', e); return false; }

    // First, quick probe: try to read spreadsheet metadata to ensure service account can access it
    try {
      const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=spreadsheetId,properties.title,sheets.properties.title`;
      const metaResp = await window.ServiceAccountAuth.fetch(metaUrl, { method: 'GET' });
      if (!metaResp.ok){ const t = await metaResp.text().catch(()=>null); console.warn('session_logger: spreadsheet metadata check failed', metaResp.status, t); enqueuePendingRow(row); window.sessionLogger._lastResult = { ok: false, enqueued: true, reason: 'metadata check failed', status: metaResp.status, text: t }; return false; }
    } catch(e){ console.warn('session_logger: spreadsheet metadata check threw', e); return false; }

    // Compose append call
    try {
      const SHEET_NAME = encodeURIComponent(LOG_SHEET_NAME + '!A1');
      const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_NAME}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
      const body = { values: [row] };
      const resp = await window.ServiceAccountAuth.fetch(appendUrl, { method: 'POST', body: JSON.stringify(body) });
      if (!resp.ok){ const errText = await resp.text().catch(()=>null); console.warn('session_logger: Append failed', resp.status, errText); enqueuePendingRow(row); window.sessionLogger._lastResult = { ok: false, status: resp.status, error: errText, enqueued: true }; return false; }
      console.log('session_logger: append response ok');
      console.log('session_logger: appended session metadata to System Logs');
      window.sessionLogger._lastResult = { ok: true, status: 200 };
      return true;
    } catch (e){ console.warn('session_logger: append error', e); enqueuePendingRow(row); window.sessionLogger._lastResult = { ok: false, error: String(e), enqueued: true }; return false; }
  }

  // Pending queue helpers — store failed rows and retry later
  function _getPendingQueue(){
    try { const raw = localStorage.getItem('session_logger_pending'); return raw ? JSON.parse(raw) : []; } catch(e){ return []; }
  }

  function _savePendingQueue(q){ try { localStorage.setItem('session_logger_pending', JSON.stringify(q||[])); } catch(e) { console.warn('session_logger: failed to save pending queue', e); } }

  function enqueuePendingRow(row){
    try {
      const q = _getPendingQueue();
      q.push({ id: 'p_'+Date.now()+'_'+Math.random().toString(36).slice(2,6), ts: new Date().toISOString(), row });
      _savePendingQueue(q);
      console.log('session_logger: enqueued pending row — total pending:', q.length);
      try { if (window.sessionLogger) window.sessionLogger._pendingCount = q.length; } catch(e){}
    } catch(e){ console.warn('session_logger: enqueue failed', e); }
  }

  async function flushPendingRows(){
    try {
      const q = _getPendingQueue();
      if (!q || q.length===0) return { ok: true, flushed: 0 };
      if (!window.ServiceAccountAuth || typeof window.ServiceAccountAuth.fetch !== 'function') { return { ok: false, reason: 'ServiceAccountAuth not available' }; }
      const SPREADSHEET_ID = window.GOOGLE_SPREADSHEET_ID || null; if (!SPREADSHEET_ID) return { ok: false, reason: 'No SPREADSHEET_ID' };
      let success = 0; const left = [];
      for (const item of q){
        try {
          const r = await appendToSystemLogs(item.row);
          if (r) success++; else left.push(item);
        } catch(e){ console.warn('session_logger.flush: item append error', e); left.push(item); }
      }
      _savePendingQueue(left);
      window.sessionLogger._pendingCount = left.length;
      return { ok: true, flushed: success, remaining: left.length };
    } catch(e){ console.warn('session_logger.flushPendingRows threw', e); return { ok: false, error: String(e) }; }
  }

  // (pending queue helpers will be attached to the public API after the main object is defined)

  // Ensure the System Logs sheet exists and has the expected header row.
  // Returns true if header exists or was created successfully.
  async function ensureSystemLogsHeader(){
    if (!window.ServiceAccountAuth || typeof window.ServiceAccountAuth.fetch !== 'function') return false;
    const SPREADSHEET_ID = window.GOOGLE_SPREADSHEET_ID || null;
    if (!SPREADSHEET_ID) return false;

    try {
      // Get sheets metadata
      const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties.title`;
      const metaResp = await window.ServiceAccountAuth.fetch(metaUrl, { method: 'GET' });
      if (!metaResp.ok){ console.warn('session_logger: spreadsheet metadata check failed (header check)'); return false; }
      const meta = await metaResp.json().catch(()=>({}));
      const sheets = Array.isArray(meta.sheets) ? meta.sheets.map(s=>s.properties && s.properties.title).filter(Boolean) : [];

      // If System Logs sheet doesn't exist, create it
      if (!sheets.includes(LOG_SHEET_NAME)){
        try {
          const addReq = { requests: [{ addSheet: { properties: { title: LOG_SHEET_NAME } } }] };
          const addUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`;
          const addResp = await window.ServiceAccountAuth.fetch(addUrl, { method: 'POST', body: JSON.stringify(addReq) });
          if (!addResp.ok){ const t = await addResp.text().catch(()=>null); console.warn('session_logger: failed to create System Logs sheet', addResp.status, t); return false; }
          console.log('session_logger: created System Logs sheet');
        } catch(e){ console.warn('session_logger: create sheet threw', e); return false; }
      }

      // Read current header row
      const headerRange = encodeURIComponent(`${LOG_SHEET_NAME}!A1:1`);
      const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${headerRange}`;
      const readResp = await window.ServiceAccountAuth.fetch(readUrl, { method: 'GET' });
      if (!readResp.ok){ const t = await readResp.text().catch(()=>null); console.warn('session_logger: failed to read header row', readResp.status, t); return false; }
      const readBody = await readResp.json().catch(()=>null);
      const values = (readBody && Array.isArray(readBody.values) && readBody.values[0]) ? readBody.values[0] : [];

      // If header missing or doesn't match our expected header length or top-level values differ, write header
      let needHeader = false;
      if (!values || values.length === 0) needHeader = true;
      else if (values.length < LOG_HEADER.length) needHeader = true;
      else {
        for (let i=0;i<LOG_HEADER.length;i++){
          const a = (String(values[i]||'').trim());
          const b = LOG_HEADER[i];
          if (!a || a.toLowerCase() !== String(b).toLowerCase()){ needHeader = true; break; }
        }
      }

      if (needHeader){
        try {
          const putUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(LOG_SHEET_NAME+'!A1')}?valueInputOption=USER_ENTERED`;
          const putBody = { values: [LOG_HEADER] };
          const putResp = await window.ServiceAccountAuth.fetch(putUrl, { method: 'PUT', body: JSON.stringify(putBody) });
          if (!putResp.ok){ const t = await putResp.text().catch(()=>null); console.warn('session_logger: failed to write header row', putResp.status, t); return false; }
          console.log('session_logger: wrote header row to System Logs');
        } catch (e){ console.warn('session_logger: write header threw', e); return false; }
      }

      return true;
    } catch (e){ console.warn('session_logger: ensureSystemLogsHeader threw', e); return false; }
  }

  // Wait for ServiceAccountAuth and spreadsheet ID to be present; resolves true if available within timeout
  async function waitForServiceAccountReady(timeoutMs = 5000, intervalMs = 500){
    const start = Date.now();
    while (Date.now() - start < timeoutMs){
      const sa = (window.ServiceAccountAuth && typeof window.ServiceAccountAuth.fetch === 'function');
      const sid = !!(window.GOOGLE_SPREADSHEET_ID);
      if (sa && sid) return true;
      await new Promise(r => setTimeout(r, intervalMs));
    }
    return false;
  }

  // Primary entrypoint — append a startup log unless already appended for the session
  // runSessionLog(force=false): if force=true, bypass the "already appended for this session" guard
  async function runSessionLog(force = false){
    try {
      const flag = 'system_logs_appended_for_session';
      if (!force && sessionStorage && sessionStorage.getItem(flag)){
        console.log('session_logger: already appended for this session — skipping');
        return;
      }

      console.log('session_logger: start runSessionLog — checking prerequisites');

      // Wait for service account helper and spreadsheet id to be ready (short retry window)
      const ready = await waitForServiceAccountReady(5000, 500);
      if (!ready) {
        console.warn('session_logger: ServiceAccountAuth or spreadsheet ID not ready — skipping automatic log. You can call window.sessionLogger.runSessionLog() later.');
        return;
      }

      const meta = await collectSessionMetadata();
      const row = metadataToRow(meta);

      // Try to append; on success set a sessionStorage flag to avoid duplicate logs
      const ok = await appendToSystemLogs(row);
      if (ok && sessionStorage){ sessionStorage.setItem(flag, '1'); }
    } catch (e){ console.warn('session_logger: run threw', e); }
  }

  // Expose manual API
  window.sessionLogger = {
    collectSessionMetadata,
    appendToSystemLogs,
    runSessionLog,
    // append an event (e.g. 'add_invoice', 'add_contact') with optional details (object or string)
    appendEvent: async function(eventType, details){
      try {
        const meta = await collectSessionMetadata();
        meta.event = eventType || '';
        // Human-friendly activity label
        meta.activity = mapEventToActivity(eventType);
        meta.details = details || '';
        const row = metadataToRow(meta);
        // non-blocking by default: run append but don't await externally unless caller does
        const ok = await appendToSystemLogs(row);
        return ok;
      } catch(e){ console.warn('session_logger.appendEvent threw', e); return false; }
    }
  };

  function mapEventToActivity(eventType){
    try {
      if (!eventType) return '';
      const et = String(eventType).toLowerCase();
      if (et === 'add_invoice') return 'Add Invoice';
      if (et === 'add_contact') return 'Add Contact';
      if (et === 'startup') return 'Startup';
      // make human readable e.g. 'delete_invoice' -> 'Delete Invoice'
      return et.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    } catch(e){ return String(eventType); }
  }

  // Convenience: force the session log to run even if already appended this session
  window.sessionLogger.forceRunSessionLog = async function(){
    try {
      // clear flag, run with force, then mark appended state
      const flag = 'system_logs_appended_for_session';
      if (sessionStorage) sessionStorage.removeItem(flag);
      const ok = await runSessionLog(true);
      if (ok && sessionStorage) sessionStorage.setItem(flag, '1');
      return ok;
    } catch(e){ console.warn('session_logger.forceRunSessionLog threw', e); return false; }
  };

    // Attach pending queue helpers now that window.sessionLogger exists
    try {
      window.sessionLogger._pendingCount = _getPendingQueue().length;
      window.sessionLogger.flushPendingRows = flushPendingRows;
      window.sessionLogger.getPendingRows = function(){ return _getPendingQueue(); };
      window.sessionLogger.clearPendingQueue = function(){ _savePendingQueue([]); window.sessionLogger._pendingCount = 0; return true; };
    } catch(e){ console.warn('session_logger: failed to attach pending helpers', e); }

  // Auto-run shortly after DOM ready (give other scripts a chance to setup ServiceAccountAuth)
  try {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', ()=>{ setTimeout(runSessionLog, 800); });
    } else { setTimeout(runSessionLog, 800); }
  } catch(e){ setTimeout(runSessionLog, 1200); }

  console.log('session_logger: loaded');
})();
